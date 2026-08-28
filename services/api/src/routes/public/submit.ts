import type { RequestContext } from '../../observability/request-context.js';
import { toErrorResponse, AppError } from '../../http/errors.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import type { CaseRecord, CaseUpdateInput } from '@tieout/schema';
import { CaseUpdateInput as CaseUpdateInputSchema } from '@tieout/schema';

export interface SubmitRouteRequest {
  params: {
    token: string;
  };
  body?: unknown;
  context: RequestContext;
}

export interface SubmitRouteDeps {
  tokenVerifier: TokenVerifier;
  db: {
    getCaseById: (caseId: string) => Promise<CaseRecord | null>;
    updateCaseDetails: (tx: unknown, caseId: string, input: CaseUpdateInput) => Promise<void>;
    transaction: <T>(callback: (tx: unknown) => Promise<T>) => Promise<T>;
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

    // Process updates if provided
    if (req.body && Object.keys(req.body).length > 0) {
      const parsedBody = CaseUpdateInputSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Invalid request body',
          parsedBody.error.flatten(),
        );
      }

      // Remove undefined fields
      const cleanData = Object.fromEntries(
        Object.entries(parsedBody.data).filter(([_, v]) => v !== undefined),
      );

      if (Object.keys(cleanData).length > 0) {
        await deps.db.transaction(async (tx) => {
          await deps.db.updateCaseDetails(tx, caseId, cleanData);
        });
      }
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
