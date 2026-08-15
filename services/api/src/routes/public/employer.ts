
import crypto from 'node:crypto';
import type { RequestContext } from '../../observability/request-context.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import { toErrorResponse } from '../../http/errors.js';
import { validateBody } from '../../security/request-validation.js';
import type { EmployerServiceDeps } from '../../services/employer/employer-service.js';
import {
  getEmployerForm,
  submitEmployerResponse,
  EmployerResponsePayloadSchema,
} from '../../services/employer/employer-service.js';

export interface EmployerRouteRequest {
  params: {
    token: string;
  };
  body?: unknown;
  context: RequestContext;
}

export interface EmployerRouteDeps extends EmployerServiceDeps {
  tokenVerifier: TokenVerifier;
}

export async function getEmployerHandler(req: EmployerRouteRequest, deps: EmployerRouteDeps) {
  try {
    // Use resolveToken so all token errors (expired/invalid/wrong purpose) map to correct HTTP codes
    await resolveToken(req.params.token, 'employer', deps.tokenVerifier);

    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const form = await getEmployerForm(tokenHash, deps);

    return {
      status: 200,
      body: { data: form },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function submitEmployerHandler(req: EmployerRouteRequest, deps: EmployerRouteDeps) {
  try {
    // Use resolveToken so all token errors map to correct HTTP codes
    await resolveToken(req.params.token, 'employer', deps.tokenVerifier);

    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const payload = validateBody(req.body, EmployerResponsePayloadSchema);

    await submitEmployerResponse(tokenHash, payload, deps);

    return {
      status: 200,
      body: { success: true, message: 'Employer response submitted successfully' },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
