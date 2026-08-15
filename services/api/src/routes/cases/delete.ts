import type { RequestContext } from '../../observability/request-context.js';
import { toErrorResponse, notFoundError } from '../../http/errors.js';
import type { EventInput, EventRecord } from '@tieout/schema';

export interface DeleteCaseDeps {
  db: {
    getCaseById: (caseId: string) => Promise<{ id: string; org_id: string } | null>;
    redactCaseAll: (tx: unknown, caseId: string) => Promise<void>;
    transaction: <T>(cb: (tx: unknown) => Promise<T>) => Promise<T>;
  };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<EventRecord>;
  };
  storage: {
    deleteDirectory: (caseId: string) => Promise<void>;
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

    // 1. Delete documents from object storage
    await deps.storage.deleteDirectory(caseId);

    // 2. Transactionally redact DB entries
    await deps.db.transaction(async (tx) => {
      // Overwrite PII with [REDACTED] in case, extractions, and forensics
      await deps.db.redactCaseAll(tx, caseId);

      // Append audit event
      await deps.audit.appendEvent(tx, {
        case_id: caseId,
        kind: 'case_deleted',
        payload: {
          message: 'Case and associated data personally identifiable information has been redacted',
        },
        actor: 'verifier',
      });
    });

    return {
      status: 204,
      body: null,
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
