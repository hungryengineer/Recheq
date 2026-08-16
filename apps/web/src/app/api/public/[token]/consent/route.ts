import { NextResponse } from 'next/server';
import { grantConsentHandler } from '@tieout/api/web';
import { getConsentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  const result = await grantConsentHandler(
    {
      params: { token },
      body,
      context: createRequestContext(),
      ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent'),
    },
    {
      ...getConsentDeps(),
      tokenVerifier: getTokenVerifier(),
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
