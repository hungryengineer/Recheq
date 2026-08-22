import {
  CaseCreateInput,
  type CaseRecord,
  type CaseSummary,
  type EventInput,
  type EventRecord,
} from '@tieout/schema';
import { validationError, notFoundError } from '../../http/errors.js';
import type { Database } from '../../db/client.js';

export type TransactionHandle = Parameters<Parameters<Database['transaction']>[0]>[0];

// Minimal interface for database operations we need in this service,
// to allow easy mocking in unit tests.
export interface CaseServiceDeps {
  db: {
    createCase: (
      input: Omit<CaseRecord, 'id' | 'created_at' | 'updated_at'>,
    ) => Promise<CaseRecord>;
    updateCaseDetails: (
      tx: TransactionHandle,
      caseId: string,
      input: Partial<
        Omit<
          CaseRecord,
          | 'id'
          | 'org_id'
          | 'created_by'
          | 'created_at'
          | 'updated_at'
          | 'status'
          | 'verdict'
          | 'risk_score'
        >
      >,
    ) => Promise<void>;
    listCasesByOrg: (orgId: string) => Promise<CaseSummary[]>;
    getCaseByIdAndOrg: (
      caseId: string,
      orgId: string,
      tx?: TransactionHandle,
    ) => Promise<CaseRecord | null>;
    transaction: <T>(cb: (tx: TransactionHandle) => Promise<T>) => Promise<T>;
  };
  audit: {
    appendEvent: (tx: TransactionHandle, input: EventInput) => Promise<EventRecord>;
  };
}

export async function createCase(
  input: unknown,
  userId: string,
  orgId: string,
  deps: CaseServiceDeps,
): Promise<CaseRecord> {
  // Validate input schema
  const parsed = CaseCreateInput.safeParse(input);
  if (!parsed.success) {
    throw validationError('Invalid case input', parsed.error.errors);
  }
  const data = parsed.data;

  // Business rule validation: end date must not be before start date
  const start = new Date(data.employment_start);
  const end = new Date(data.employment_end);
  if (end < start) {
    throw validationError('Employment end date cannot be before start date');
  }

  // Create the record
  const recordToCreate: Omit<CaseRecord, 'id' | 'created_at' | 'updated_at'> = {
    org_id: orgId,
    created_by: userId,
    employer_name: data.employer_name,
    candidate_name: data.candidate_name,
    candidate_email: data.candidate_email,
    title: data.title,
    claimed_ctc: data.claimed_ctc,
    employment_start: data.employment_start,
    employment_end: data.employment_end,
    uan: data.uan ?? null,
    status: 'awaiting_consent',
    verdict: null,
    risk_score: null,
  };

  return await deps.db.createCase(recordToCreate);
}

export async function updateCase(
  caseId: string,
  input: unknown,
  userId: string,
  orgId: string,
  deps: CaseServiceDeps,
): Promise<void> {
  // We lazily import CaseUpdateInput to avoid circular issues, or use it directly if imported.
  // We'll import it at the top of the file via the schema package.
  const parsed = (await import('@tieout/schema')).CaseUpdateInput.safeParse(input);
  if (!parsed.success) {
    throw validationError('Invalid case update input', parsed.error.errors);
  }
  const data = parsed.data;

  if (Object.keys(data).length === 0) {
    return; // nothing to update
  }

  await deps.db.transaction(async (tx) => {
    const caseRecord = await deps.db.getCaseByIdAndOrg(caseId, orgId, tx);
    if (!caseRecord) {
      throw notFoundError(`Case ${caseId} not found`);
    }

    // If employment dates are being updated, ensure end >= start
    const startRaw = data.employment_start ?? caseRecord.employment_start;
    const endRaw = data.employment_end ?? caseRecord.employment_end;
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (end < start) {
      throw validationError('Employment end date cannot be before start date');
    }

    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined),
    ) as Parameters<typeof deps.db.updateCaseDetails>[2];

    await deps.db.updateCaseDetails(tx, caseId, cleanData);

    // Write audit trail entry
    await deps.audit.appendEvent(tx, {
      case_id: caseId,
      kind: 'case_updated',
      payload: { changes: cleanData },
      actor: userId, // The user performing the edit
    });
  });
}

export async function listCases(orgId: string, deps: CaseServiceDeps): Promise<CaseSummary[]> {
  return await deps.db.listCasesByOrg(orgId);
}

export async function getCase(
  caseId: string,
  orgId: string,
  deps: CaseServiceDeps,
): Promise<CaseRecord> {
  // Basic validation of uuid format could go here, but DB will likely reject bad uuids anyway
  const caseRecord = await deps.db.getCaseByIdAndOrg(caseId, orgId);

  if (!caseRecord) {
    throw notFoundError(`Case ${caseId} not found`);
  }

  return caseRecord;
}
