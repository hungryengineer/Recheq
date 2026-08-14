import type { RequestContext } from '../../observability/request-context.js';
import { listCases, type CaseServiceDeps } from '../../services/cases/case-service.js';
import { toErrorResponse } from '../../http/errors.js';

export interface ListCasesRequest {
  context: RequestContext;
  auth: {
    userId: string;
    orgId: string;
  };
}

export async function listCasesHandler(req: ListCasesRequest, deps: CaseServiceDeps) {
  try {
    const cases = await listCases(req.auth.orgId, deps);
    return {
      status: 200,
      body: {
        data: cases,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
