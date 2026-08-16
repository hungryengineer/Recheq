import type { RequestContext } from '../../observability/request-context.js';
import { toErrorResponse, AppError } from '../../http/errors.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import type { CaseRecord } from '@tieout/schema';

export interface SubmitRouteRequest {
  params: {
    token: string;
  };
  context: RequestContext;
}

export interface SubmitRouteDeps {
  tokenVerifier: TokenVerifier;
  db: {
    getCaseById: (caseId: string) => Promise<CaseRecord | null>;
  };
}

// In Next.js, we will call startProcessing(caseId) separately after this handler returns 202
export async function submitCaseHandler(req: SubmitRouteRequest, deps: SubmitRouteDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);
    const caseRecord = await deps.db.getCaseById(caseId);

    if (!caseRecord) {
      throw new AppError(404, 'NOT_FOUND', 'Case not found');
    }

    if (caseRecord.status !== 'awaiting_documents') {
      throw new AppError(409, 'CONFLICT', 'Case is not ready for submission');
    }

    return {
      status: 202,
      body: {
        status: 'processing',
        caseId, // We expose this so Next.js adapter can read it to start processing
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
