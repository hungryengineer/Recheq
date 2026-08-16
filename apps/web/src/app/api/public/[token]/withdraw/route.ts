import { NextResponse } from 'next/server';
import { withdrawConsentHandler } from '@tieout/api/web';
import { getConsentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const result = await withdrawConsentHandler(
    {
      params: { token },
      context: createRequestContext(),
    },
    {
      ...getConsentDeps(),
      tokenVerifier: getTokenVerifier(),
    },
  );

  return NextResponse.json(result.body, { status: result.status });
}
