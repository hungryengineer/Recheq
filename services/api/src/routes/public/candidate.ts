import type { RequestContext } from '../../observability/request-context.js';
import type { ConsentServiceDeps } from '../../services/consent/consent-service.js';
import { getCandidateView } from '../../services/consent/consent-service.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import { toErrorResponse } from '../../http/errors.js';

// ─── GET /api/public/:token ─────────────────────────────────────
// Returns only candidate-safe case information.
// Never exposes risk_score, verdict, findings, or org-internal data.

export interface CandidateRouteRequest {
  params: {
    token: string;
  };
  context: RequestContext;
}

export interface CandidateRouteDeps extends ConsentServiceDeps {
  tokenVerifier: TokenVerifier;
}

export async function getCandidateHandler(req: CandidateRouteRequest, deps: CandidateRouteDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);
    const view = await getCandidateView(caseId, deps);

    return {
      status: 200,
      body: {
        data: view,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
