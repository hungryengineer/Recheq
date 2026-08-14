import type { RequestContext } from '../../observability/request-context.js';
import type { ConsentServiceDeps } from '../../services/consent/consent-service.js';
import {
  grantConsent,
  withdrawConsent,
  hashToken,
} from '../../services/consent/consent-service.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import { toErrorResponse } from '../../http/errors.js';

// ─── POST /api/public/:token/consent ────────────────────────────
// Stores verbatim consent text, version, timestamp, IP, and user agent.

export interface ConsentGrantRequest {
  params: {
    token: string;
  };
  body: unknown;
  context: RequestContext;
  /** IP address of the consenting party */
  ip: string | null;
  /** User-Agent header of the consenting party */
  userAgent: string | null;
}

export interface ConsentRouteDeps extends ConsentServiceDeps {
  tokenVerifier: TokenVerifier;
}

export async function grantConsentHandler(req: ConsentGrantRequest, deps: ConsentRouteDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);

    const consent = await grantConsent(
      caseId,
      req.body,
      {
        ip_address: req.ip,
        user_agent: req.userAgent,
        token_hash: hashToken(req.params.token),
      },
      deps,
    );

    return {
      status: 201,
      body: {
        data: consent,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}

// ─── POST /api/public/:token/withdraw ───────────────────────────
// Records withdrawn_at, transitions the case, and appends an audit event.

export interface WithdrawConsentRequest {
  params: {
    token: string;
  };
  context: RequestContext;
}

export async function withdrawConsentHandler(req: WithdrawConsentRequest, deps: ConsentRouteDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);

    await withdrawConsent(caseId, deps);

    return {
      status: 200,
      body: {
        data: { withdrawn: true },
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
