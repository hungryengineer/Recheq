/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { createRequestContext } from '@recheq/api/src/observability/request-context.js';
import { toErrorResponse } from '@recheq/api/src/http/errors.js';
import { buildDeps } from './deps';

import type { CaseProcessingDeps } from '@recheq/api/src/workflows/case-processing.js';

export function toHandler<TReq = unknown>(fn: (req: TReq, deps: any) => Promise<unknown>) {
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
        } catch {
          // ignore empty body parse errors
        }
      }

      const reqCtx = createRequestContext({
        requestId,
        service: 'api',
      });

      let userId: string | null = null;
      let orgId: string | null = null;
      let role: string | null = null;

      const authHeader = request.headers.get('authorization');
      let token = '';

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        const cookieHeader = request.headers.get('cookie') || '';
        const match = cookieHeader.match(/recheq_session=([^;]+)/);
        if (match) token = match[1];
      }

      if (token) {
        const { verifyToken } = await import('@recheq/api/src/security/jwt.js');
        const payload = await verifyToken(token);
        if (payload) {
          userId = payload.userId;
          orgId = payload.orgId;
          role = payload.role;
        }
      }

      if (!userId || !orgId) {
        return NextResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Missing or invalid authentication token',
              request_id: requestId,
            },
          },
          { status: 401 },
        );
      }

      const auth = { userId, orgId, role: role || 'verifier' };

      const params = context?.params ? await context.params : undefined;

      const handlerReq = {
        body,
        context: reqCtx,
        auth,
        params,
        raw: request,
      };

      const deps = buildDeps();
      const result = (await fn(handlerReq as TReq, deps as any)) as any;

      if (result.status >= 400 && result.body && result.body.error) {
        result.body.error.request_id = requestId;
      }
      if (result.status === 204) {
        return new NextResponse(null, { status: 204 });
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

export function toPublicHandler<TReq = unknown>(fn: (req: TReq, deps: any) => Promise<unknown>) {
  return async function (request: Request, context: any) {
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
      const result = (await fn(handlerReq as TReq, deps as any)) as any;

      if (result.status >= 400 && result.body && result.body.error) {
        result.body.error.request_id = requestId;
      }
      if (result.status === 204) {
        return new NextResponse(null, { status: 204 });
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
