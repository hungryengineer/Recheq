import type { RequestContext } from '../../observability/request-context.js';
import { updateCase, type CaseServiceDeps } from '../../services/cases/case-service.js';
import { toErrorResponse } from '../../http/errors.js';

export interface UpdateCaseRequest {
  params: {
    id: string;
  };
  body: unknown;
  context: RequestContext;
  auth: {
    userId: string;
    orgId: string;
  };
}

export async function updateCaseHandler(req: UpdateCaseRequest, deps: CaseServiceDeps) {
  try {
    await updateCase(req.params.id, req.body, req.auth.userId, req.auth.orgId, deps);
    return {
      status: 200,
      body: {
        message: 'Case updated',
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
