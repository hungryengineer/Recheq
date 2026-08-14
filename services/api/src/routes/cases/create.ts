// Mock request context/interfaces for route handlers since Express/Fastify isn't set up yet
import type { RequestContext } from '../../observability/request-context.js';
import { createCase, type CaseServiceDeps } from '../../services/cases/case-service.js';
import { toErrorResponse } from '../../http/errors.js';

export interface CreateCaseRequest {
  body: unknown;
  context: RequestContext;
  // Auth context would typically be populated by middleware
  auth: {
    userId: string;
    orgId: string;
  };
}

export async function createCaseHandler(req: CreateCaseRequest, deps: CaseServiceDeps) {
  try {
    const newCase = await createCase(req.body, req.auth.userId, req.auth.orgId, deps);
    return {
      status: 201,
      body: {
        data: newCase,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
