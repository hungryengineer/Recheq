import { CaseCreateInput, type CaseRecord, type CaseSummary } from '@tieout/schema';
import { validationError, notFoundError } from '../../http/errors.js';

// Minimal interface for database operations we need in this service,
// to allow easy mocking in unit tests.
export interface CaseServiceDeps {
  db: {
    createCase: (
      input: Omit<CaseRecord, 'id' | 'created_at' | 'updated_at'>,
    ) => Promise<CaseRecord>;
    listCasesByOrg: (orgId: string) => Promise<CaseSummary[]>;
    getCaseByIdAndOrg: (caseId: string, orgId: string) => Promise<CaseRecord | null>;
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
    status: 'draft',
    verdict: null,
    risk_score: null,
  };

  return await deps.db.createCase(recordToCreate);
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
