import { toErrorResponse, AppError } from '../../http/errors.js';
import type { RequestContext } from '../../observability/request-context.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import type { DisputeServiceDeps } from '../../services/findings/dispute-service.js';
import { disputeFinding } from '../../services/findings/dispute-service.js';

export interface DisputeRouteRequest {
  params: {
    token: string;
  };
  body: unknown;
  context: RequestContext;
}

export interface DisputeRouteDeps extends DisputeServiceDeps {
  tokenVerifier: TokenVerifier;
}

export async function disputeHandler(req: DisputeRouteRequest, deps: DisputeRouteDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);
    const body = req.body as { finding_id?: string; reason?: string };

    if (
      !body ||
      typeof body.finding_id !== 'string' ||
      typeof body.reason !== 'string' ||
      body.reason.trim().length === 0
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payload');
    }

    await disputeFinding(caseId, body.finding_id, body.reason, deps);

    return {
      status: 200,
      body: {
        success: true,
        message: 'Finding has been disputed successfully',
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
