export const runtime = 'nodejs';

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { loginHandler } from '@recheq/api/src/routes/auth/login.js';
import { toErrorResponse } from '@recheq/api/src/http/errors.js';
import { getDb } from '@/lib/server/db';

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    const ip =
      (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0]?.trim() ?? '127.0.0.1';

    const result = await loginHandler({ body, ip }, { db: getDb() });

    if (result.status >= 400 && result.body && (result.body as Record<string, unknown>).error) {
      ((result.body as Record<string, unknown>).error as Record<string, unknown>).request_id =
        requestId;
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error('Login handler error:', err);
    const errorResponse = toErrorResponse(err);

    if (errorResponse.body?.error) {
      (errorResponse.body.error as Record<string, unknown>).request_id = requestId;
    }

    return NextResponse.json(errorResponse.body, { status: errorResponse.status });
  }
}
