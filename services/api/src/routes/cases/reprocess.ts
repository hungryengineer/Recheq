import type { RequestContext } from '../../observability/request-context.js';
import {
  requestReprocess,
  type ReprocessServiceDeps,
} from '../../services/cases/reprocess-service.js';
import { toErrorResponse } from '../../http/errors.js';

export interface ReprocessCaseRequest {
  params: {
    id: string;
  };
  context: RequestContext;
  auth: {
    userId: string;
    orgId: string;
  };
}

export async function reprocessCaseHandler(req: ReprocessCaseRequest, deps: ReprocessServiceDeps) {
  try {
    await requestReprocess(req.params.id, deps);
    return {
      status: 202,
      body: {
        message: 'Reprocess triggered',
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
