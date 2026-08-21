export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { loginHandler } from '@tieout/api/src/routes/auth/login.js';
import { toErrorResponse } from '@tieout/api/src/http/errors.js';
import { getDb } from '@/lib/server/db';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));

    const result = await loginHandler({ body }, { db: getDb() });

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
