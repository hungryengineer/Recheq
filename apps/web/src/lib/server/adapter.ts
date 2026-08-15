import { NextResponse } from 'next/server';
import { createRequestContext } from '@tieout/api/src/observability/request-context.js';
import { toErrorResponse } from '@tieout/api/src/http/errors.js';
import { buildDeps } from './deps';

import type { CaseProcessingDeps } from '@tieout/api/src/workflows/case-processing.js';

export function toHandler<TReq = unknown>(
  fn: (req: TReq, deps: CaseProcessingDeps) => Promise<unknown>,
) {
  return async function (request: Request, _context: unknown) {
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
        } catch {
          // ignore empty body parse errors
        }
      }

      const reqCtx = createRequestContext({
        requestId,
        service: 'api',
      });

      const isLocalDev = process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true';
      const userId =
        request.headers.get('x-user-id') || (isLocalDev ? process.env.DEV_USER_ID : null);
      const orgId = request.headers.get('x-org-id') || (isLocalDev ? process.env.DEV_ORG_ID : null);

      if (!userId || !orgId) {
        return NextResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Missing authentication headers',
              request_id: requestId,
            },
          },
          { status: 401 },
        );
      }

      const auth = { userId, orgId };

      const handlerReq = {
        body,
        context: reqCtx,
        auth,
        raw: request,
      };

      const deps = buildDeps();
      const result = await fn(handlerReq as TReq, deps);

      if (result.status >= 400 && result.body && result.body.error) {
        result.body.error.request_id = requestId;
      }

      return NextResponse.json(result.body, { status: result.status });
    } catch (err) {
      console.error('Unhandled handler error:', err);
      const errorResponse = toErrorResponse(err);

      // Attach request_id to match OpenAPI contract
      (errorResponse.body.error as Record<string, unknown>).request_id = requestId;

      return NextResponse.json(errorResponse.body, { status: errorResponse.status });
    }
  };
}

export function toPublicHandler<TReq = unknown>(
  fn: (req: TReq, deps: CaseProcessingDeps) => Promise<unknown>,
) {
  return async function (request: Request, context: { params: Promise<Record<string, string>> }) {
    const requestId = crypto.randomUUID();
    try {
      let body: unknown = {};

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const contentType = request.headers.get('content-type') || '';
        // If multipart/form-data, skip body parsing here and let the handler deal with request.formData()
        if (contentType.includes('application/json')) {
          try {
            const text = await request.text();
            if (text) {
              body = JSON.parse(text);
            }
          } catch {
            // ignore empty body parse errors
          }
        }
      }

      const reqCtx = createRequestContext({
        requestId,
        service: 'api',
      });

      const params = await context.params;

      const handlerReq = {
        body,
        context: reqCtx,
        params,
        raw: request,
      };

      const deps = buildDeps();
      const result = await fn(handlerReq as TReq, deps);

      if (result.status >= 400 && result.body && result.body.error) {
        result.body.error.request_id = requestId;
      }

      return NextResponse.json(result.body, { status: result.status });
    } catch (err) {
      console.error('Unhandled public handler error:', err);
      const errorResponse = toErrorResponse(err);

      if (errorResponse.body && errorResponse.body.error) {
        (errorResponse.body.error as Record<string, unknown>).request_id = requestId;
      }

      return NextResponse.json(errorResponse.body, { status: errorResponse.status });
    }
  };
}
