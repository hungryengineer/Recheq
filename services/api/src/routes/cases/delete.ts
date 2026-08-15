import type { RequestContext } from '../../observability/request-context.js';
import { toErrorResponse, notFoundError } from '../../http/errors.js';
import type { EventInput, EventRecord, CaseStatus } from '@tieout/schema';

export interface DeleteCaseDeps {
  db: {
    getCaseById: (caseId: string) => Promise<{ id: string; org_id: string } | null>;
    redactCase: (caseId: string) => Promise<void>;
  };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<EventRecord>;
  };
}

export interface DeleteCaseRequest {
  params: {
    id: string;
  };
  context: RequestContext;
  auth: {
    userId: string;
    orgId: string;
  };
}

export async function deleteCaseHandler(req: DeleteCaseRequest, deps: DeleteCaseDeps) {
  try {
    const caseId = req.params.id;
    const caseRecord = await deps.db.getCaseById(caseId);

    if (!caseRecord || caseRecord.org_id !== req.auth.orgId) {
      throw notFoundError(`Case ${caseId} not found`);
    }

    // Overwrite PII with [REDACTED]
    await deps.db.redactCase(caseId);

    // Append audit event
    await deps.audit.appendEvent(null, {
      case_id: caseId,
      kind: 'case_deleted',
      payload: {
        message: 'Case personally identifiable information has been redacted',
      },
      actor: 'verifier',
    });

    return {
      status: 204,
      body: null,
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
