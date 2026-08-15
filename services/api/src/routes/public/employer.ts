import type { RequestContext } from '../../observability/request-context.js';
import type { TokenVerifier } from './token-auth.js';
import { toErrorResponse, AppError } from '../../http/errors.js';
import type { EmployerServiceDeps } from '../../services/employer/employer-service.js';
import {
  getEmployerForm,
  submitEmployerResponse,
} from '../../services/employer/employer-service.js';
import crypto from 'node:crypto';

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

type EmployerResponsePayloadType = {
  confirmed: boolean;
  corrected_name?: string;
  corrected_title?: string;
  corrected_ctc?: number;
  note?: string;
};

export async function getEmployerHandler(req: EmployerRouteRequest, deps: EmployerRouteDeps) {
  try {
    // Validate token
    await deps.tokenVerifier.verifyAndGetCaseId(req.params.token, 'employer');

    // Hash token to look up request
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const form = await getEmployerForm(tokenHash, deps);

    return {
      status: 200,
      body: {
        data: form,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function submitEmployerHandler(req: EmployerRouteRequest, deps: EmployerRouteDeps) {
  try {
    // Validate token
    await deps.tokenVerifier.verifyAndGetCaseId(req.params.token, 'employer');

    // Hash token to look up request
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const body = req.body as EmployerResponsePayloadType;
    if (!body || typeof body.confirmed !== 'boolean') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payload');
    }

    await submitEmployerResponse(tokenHash, body, deps);

    return {
      status: 200,
      body: {
        success: true,
        message: 'Employer response submitted successfully',
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
