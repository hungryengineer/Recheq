import type { RequestContext } from '../../observability/request-context.js';
import { toErrorResponse, validationError, notFoundError } from '../../http/errors.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import type { EpfoServiceDeps } from '../../epfo/epfo-service.js';
import { syncEpfoHistory } from '../../epfo/epfo-service.js';

export interface SubmitUanRequest {
  params: {
    token: string;
  };
  body: unknown;
  context: RequestContext;
}

export interface SubmitUanDeps extends EpfoServiceDeps {
  tokenVerifier: TokenVerifier;
  db: EpfoServiceDeps['db'] & {
    getConsentByCaseId: (caseId: string) => Promise<{ id: string } | null>;
  };
}

export async function submitUanHandler(req: SubmitUanRequest, deps: SubmitUanDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);

    const body = req.body as { uan?: unknown };
    if (!body || typeof body.uan !== 'string' || !/^[0-9]{12}$/.test(body.uan)) {
      throw validationError('Invalid UAN format');
    }

    const consent = await deps.db.getConsentByCaseId(caseId);
    if (!consent) {
      throw notFoundError('Consent not found for this case');
    }

    // Trigger sync in the background or await it
    await syncEpfoHistory(deps, caseId, consent.id, body.uan);

    return {
      status: 200,
      body: {
        accepted: true,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
