import { NextResponse } from 'next/server';
import { projectCaseDetail } from '@/lib/server/projections';
import { validate } from 'uuid';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    // 1. Validate UUID
    const { id } = await context.params;
    if (!validate(id)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid case ID format',
            request_id: requestId,
          },
        },
        { status: 400 },
      );
    }

    // 2. Auth checking (using the same hardcoded dev defaults as in adapter for consistency)
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

    // 3. Project case
    const caseDetail = await projectCaseDetail(id, orgId);

    if (!caseDetail) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: `Case ${id} not found`,
            request_id: requestId,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json(caseDetail, { status: 200 });
  } catch (err) {
    console.error('Error fetching case detail:', err);
    // Mimic adapter.ts behavior for unexpected errors
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          request_id: requestId,
        },
      },
      { status: 500 },
    );
  }
}
