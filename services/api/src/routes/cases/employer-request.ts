import { z } from 'zod';
import { toErrorResponse } from '../../http/errors.js';
import type { RequestContext } from '../../observability/request-context.js';
import { validateBody } from '../../security/request-validation.js';
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

const EmployerRequestPayload = z.object({
  employer_email: z.string().email(),
});

export async function createEmployerRequestHandler(
  req: EmployerRequestRouteRequest,
  deps: EmployerRequestRouteDeps,
) {
  try {
    const payload = validateBody(req.body, EmployerRequestPayload);

    const result = await createEmployerRequest(req.params.id, payload.employer_email, deps);

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
