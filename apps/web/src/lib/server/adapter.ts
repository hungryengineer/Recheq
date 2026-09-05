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
        const { getDb } = await import('@/lib/server/db');
        const { verifySessionToken } = await import('@recheq/api/src/security/session.js');
        const payload = await verifySessionToken(getDb(), token);
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

export function toApiKeyHandler<TReq = unknown>(fn: (req: TReq, deps: any) => Promise<unknown>) {
  return async function (request: Request, context: any) {
    const requestId = crypto.randomUUID();
    try {
      let body: unknown = {};

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

      const { authenticateApiKey, createApiKeyRepository } = await import(
        '@recheq/api/src/security/api-key-auth.js'
      );
      const authHeader = request.headers.get('authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Missing API key. Provide it in the Authorization: Bearer header.',
              request_id: requestId,
            },
          },
          { status: 401 },
        );
      }

      const secret = authHeader.substring(7).trim();
      const { db } = await import('@/lib/server/db');
      const apiKeyContext = await authenticateApiKey(createApiKeyRepository(db), secret);

      if (!apiKeyContext) {
        return NextResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid API key',
              request_id: requestId,
            },
          },
          { status: 401 },
        );
      }

      const reqCtx = createRequestContext({
        requestId,
        service: 'api',
      });

      const params = context?.params ? await context.params : undefined;

      // Parse query string for GET read endpoints.
      const query: Record<string, string | undefined> = {};
      if (request.method === 'GET') {
        try {
          const url = new URL(request.url);
          for (const [key, value] of url.searchParams.entries()) {
            query[key] = value;
          }
        } catch {
          // ignore malformed query
        }
      }

      const handlerReq = {
        body,
        context: reqCtx,
        auth: { orgId: apiKeyContext.orgId, apiKeyId: apiKeyContext.apiKeyId, name: apiKeyContext.name },
        params,
        query,
        raw: request,
      };

      const deps = (await import('@/lib/server/deps')).buildDeps();
      const result = (await fn(handlerReq as TReq, deps as any)) as any;

      if (result.status >= 400 && result.body && result.body.error) {
        result.body.error.request_id = requestId;
      }

      return NextResponse.json(result.body, { status: result.status });
    } catch (err) {
      console.error('Unhandled API key handler error:', err);
      const errorResponse = toErrorResponse(err);

      if (errorResponse.body && errorResponse.body.error) {
        (errorResponse.body.error as Record<string, unknown>).request_id = requestId;
      }

      return NextResponse.json(errorResponse.body, { status: errorResponse.status });
    }
  };
}

export function toPublicHandler<TReq = unknown>(fn: (req: TReq, deps: any) => Promise<unknown>) {
  return async function (request: Request, context: any) {
    const requestId = crypto.randomUUID();

    // Durable rate limiting for public token endpoints (upload, submit, UAN,
    // consent, status, ...). Backed by Postgres so the limit holds across
    // serverless instances. Wired here so every public route inherits it.
    try {
      const { createRateLimiter } = await import('@recheq/api/src/security/rate-limit.js');
      const { createSqlRateLimitStore, createRateLimitCounterRepo } = await import(
        '@recheq/api/src/security/sql-rate-limit-store.js'
      );
      const { getDb } = await import('@/lib/server/db');
      const windowMs = Number(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS ?? 60_000);
      const maxRequests = Number(process.env.RATE_LIMIT_PUBLIC_MAX ?? 10);
      const rateLimit = createRateLimiter(
        createSqlRateLimitStore(createRateLimitCounterRepo(getDb())),
        { windowMs, maxRequests },
        'public',
      );

      const blocked = await rateLimit(request, () =>
        Promise.resolve(new Response(null, { status: 200 })),
      );
      if (blocked.status === 429) {
        return blocked;
      }
    } catch (err) {
      // Never fail-open silently: if the limiter itself errors, log loudly but
      // continue so functional failures do not take public endpoints down.
      console.error('Rate limiter error (continuing):', err);
    }

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
