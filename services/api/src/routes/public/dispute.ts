import { z } from 'zod';
import { toErrorResponse } from '../../http/errors.js';
import type { RequestContext } from '../../observability/request-context.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import { validateBody } from '../../security/request-validation.js';
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

const DisputePayload = z.object({
  finding_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

export async function disputeHandler(req: DisputeRouteRequest, deps: DisputeRouteDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);
    const payload = validateBody(req.body, DisputePayload);

    await disputeFinding(caseId, payload.finding_id, payload.reason, deps);

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
