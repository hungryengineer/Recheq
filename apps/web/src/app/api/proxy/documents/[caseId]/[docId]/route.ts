import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; docId: string }> },
) {
  const { caseId, docId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('recheq_session')?.value;

  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const backendUrl = process.env.API_BASE_URL || 'http://localhost:4010';

  try {
    const res = await fetch(`${backendUrl}/api/cases/${caseId}/documents/${docId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return new NextResponse(`Backend error: ${res.status}`, { status: res.status });
    }

    const blob = await res.blob();

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="document-${docId}.pdf"`,
      },
    });
  } catch {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
