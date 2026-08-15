import type { EventInput, CaseRecord } from '@tieout/schema';
import { AppError } from '../../http/errors.js';
import { generateToken } from '../../tokens/generate-token.js';
import { publishJob } from '../../workflows/pgboss.js';

export interface EmployerServiceDeps {
  db: {
    transaction: <T>(cb: (tx: unknown) => Promise<T>) => Promise<T>;
    getCaseById: (tx: unknown, caseId: string) => Promise<CaseRecord | null>;
    createEmployerRequest: (
      tx: unknown,
      req: { case_id: string; token_hash: string; employer_email: string; expires_at: Date },
    ) => Promise<{ id: string }>;
    getEmployerRequestByToken: (
      tx: unknown,
      tokenHash: string,
    ) => Promise<{ id: string; case_id: string; employer_email: string; status: string } | null>;
    updateEmployerRequestResponse: (
      tx: unknown,
      requestId: string,
      responseData: unknown,
    ) => Promise<void>;
  };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<unknown>;
  };
  worker: {
    enqueueReprocess: (caseId: string) => Promise<void>;
  };
}

export async function createEmployerRequest(
  caseId: string,
  employerEmail: string,
  deps: EmployerServiceDeps,
): Promise<{ rawToken: string }> {
  return deps.db.transaction(async (tx) => {
    const caseRecord = await deps.db.getCaseById(tx, caseId);
    if (!caseRecord) {
      throw new AppError(404, 'CASE_NOT_FOUND', 'Case not found');
    }

    const { rawToken, tokenHash } = generateToken('emp_');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const request = await deps.db.createEmployerRequest(tx, {
      case_id: caseId,
      token_hash: tokenHash,
      employer_email: employerEmail,
      expires_at: expiresAt,
    });

    await deps.audit.appendEvent(tx, {
      case_id: caseId,
      kind: 'employer_request_sent',
      payload: {
        employer_email: employerEmail,
        employer_request_id: request.id,
      },
      actor: 'verifier',
    });

    const isDemo = process.env.DEMO_MODE === 'true';
    const delaySeconds = isDemo ? 3 : 48 * 3600;

    await publishJob(
      'EMPLOYER_WORKFLOW',
      {
        caseId,
        employerRequestId: request.id,
        reminderIndex: 1,
      },
      { delaySeconds },
    );

    return { rawToken };
  });
}

export async function getEmployerForm(tokenHash: string, deps: EmployerServiceDeps) {
  return deps.db.transaction(async (tx) => {
    const request = await deps.db.getEmployerRequestByToken(tx, tokenHash);
    if (!request) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'Employer request not found');
    }

    const caseRecord = await deps.db.getCaseById(tx, request.case_id);
    if (!caseRecord) {
      throw new AppError(404, 'CASE_NOT_FOUND', 'Case not found');
    }

    return {
      candidate_name: caseRecord.candidate_name,
      title: caseRecord.title,
      claimed_ctc: caseRecord.claimed_ctc,
      employer_email: request.employer_email,
      status: request.status,
    };
  });
}

export interface EmployerResponsePayload extends Record<string, unknown> {
  confirmed: boolean;
  corrected_name?: string;
  corrected_title?: string;
  corrected_ctc?: number;
  note?: string;
}

export async function submitEmployerResponse(
  tokenHash: string,
  payload: EmployerResponsePayload,
  deps: EmployerServiceDeps,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    const request = await deps.db.getEmployerRequestByToken(tx, tokenHash);
    if (!request) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'Employer request not found');
    }

    if (request.status !== 'pending') {
      throw new AppError(400, 'REQUEST_ALREADY_RESPONDED', 'Request has already been responded to');
    }

    await deps.db.updateEmployerRequestResponse(tx, request.id, payload);

    await deps.audit.appendEvent(tx, {
      case_id: request.case_id,
      kind: 'employer_response_received',
      payload,
      actor: 'employer',
    });

    await deps.worker.enqueueReprocess(request.case_id);
  });
}
