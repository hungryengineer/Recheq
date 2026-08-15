import { NextResponse } from 'next/server';
import { createRequestContext } from '@tieout/api/src/observability/request-context.js';
import { toErrorResponse } from '@tieout/api/src/http/errors.js';
import { buildDeps } from './deps';

export function toHandler(fn: any) {
  return async function (request: Request, context: any) {
    const requestId = crypto.randomUUID();
    try {
      let body: unknown = {};

      // Parse JSON body if present
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          const contentType = request.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const text = await request.text();
            if (text) {
              body = JSON.parse(text);
            }
          }
        } catch (e) {
          // ignore empty body parse errors
        }
      }

      const reqCtx = createRequestContext({
        requestId,
        service: 'api',
      });

      const auth = {
        userId: process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001',
        orgId: process.env.DEV_ORG_ID || '00000000-0000-0000-0000-000000000002',
      };

      const handlerReq = {
        body,
        context: reqCtx,
        auth,
        raw: request,
      };

      const deps = buildDeps();
      const result = await fn(handlerReq, deps);

      if (result.status >= 400 && result.body && result.body.error) {
        result.body.error.request_id = requestId;
      }

      return NextResponse.json(result.body, { status: result.status });
    } catch (err) {
      console.error('Unhandled handler error:', err);
      const errorResponse = toErrorResponse(err);

      // Attach request_id to match OpenAPI contract
      (errorResponse.body.error as any).request_id = requestId;

      return NextResponse.json(errorResponse.body, { status: errorResponse.status });
    }
  };
}
