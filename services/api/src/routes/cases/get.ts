import type { RequestContext } from '../../observability/request-context.js';
import { getCase, type CaseServiceDeps } from '../../services/cases/case-service.js';
import { toErrorResponse } from '../../http/errors.js';

export interface GetCaseRequest {
  params: {
    id: string;
  };
  context: RequestContext;
  auth: {
    userId: string;
    orgId: string;
  };
}

export async function getCaseHandler(req: GetCaseRequest, deps: CaseServiceDeps) {
  try {
    const caseRecord = await getCase(req.params.id, req.auth.orgId, deps);
    return {
      status: 200,
      body: {
        data: caseRecord,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
