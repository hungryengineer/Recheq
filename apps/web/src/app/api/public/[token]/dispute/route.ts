import { NextResponse } from 'next/server';

function isDisputeBody(value: unknown): value is { finding_id: string; reason: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const findingId = Reflect.get(value, 'finding_id');
  const reason = Reflect.get(value, 'reason');

  if (
    typeof findingId !== 'string' ||
    findingId.trim().length === 0 ||
    typeof reason !== 'string' ||
    reason.trim().length === 0
  ) {
    return false;
  }
  return true;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
    }

    if (!isDisputeBody(body)) {
      return NextResponse.json(
        { success: false, message: 'Missing finding_id or reason' },
        { status: 400 },
      );
    }

    if (process.env.NODE_ENV === 'production') {
      // In production, manually proxy to backend since Next.js fallback rewrites
      // will not trigger when this dynamic route file exists.
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      return await fetch(`${backendUrl}/api/public/${token}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    }

    // MOCK RESPONSE FOR NON-PRODUCTION (LOCAL UI TESTING)
    if (!token || token === 'invalid' || token === 'expired') {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Finding has been disputed successfully',
    });
  } catch (error) {
    console.error('Unexpected error in dispute route:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
