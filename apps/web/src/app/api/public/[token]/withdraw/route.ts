import { NextResponse } from 'next/server';
import { withdrawConsentHandler, toErrorResponse } from '@recheq/api/web';
import { getConsentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  try {
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
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
