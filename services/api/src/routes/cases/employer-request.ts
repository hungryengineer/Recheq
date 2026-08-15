import { toErrorResponse, AppError } from '../../http/errors.js';
import type { RequestContext } from '../../observability/request-context.js';
import type { EmployerServiceDeps } from '../../services/employer/employer-service.js';
import { createEmployerRequest } from '../../services/employer/employer-service.js';

export interface EmployerRequestRouteRequest {
  params: {
    id: string; // case id
  };
  body: unknown;
  context: RequestContext;
}

export type EmployerRequestRouteDeps = EmployerServiceDeps;

export async function createEmployerRequestHandler(
  req: EmployerRequestRouteRequest,
  deps: EmployerRequestRouteDeps,
) {
  try {
    const body = req.body as { employer_email?: string };
    if (!body || typeof body.employer_email !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payload');
    }

    const result = await createEmployerRequest(req.params.id, body.employer_email, deps);

    return {
      status: 201,
      body: {
        success: true,
        message: 'Employer request created and sent',
        // In a real system, the token wouldn't be returned but sent via email.
        // Returning it here for testing/demo purposes.
        token: result.rawToken,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
