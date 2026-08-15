import { NextResponse } from 'next/server';
import { uploadDocumentHandler } from '@tieout/api/src/routes/public/documents.js';
import { createRequestContext } from '@tieout/api/src/observability/request-context.js';
import { buildDeps } from '../../../../../lib/server/deps';
import { toErrorResponse } from '@tieout/api/src/http/errors.js';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const formData = await request.formData();
    const fileNode = formData.get('file');
    const kind = formData.get('kind');

    if (!fileNode || typeof fileNode === 'string') {
      return NextResponse.json({
        error: { code: 'INVALID_REQUEST', message: 'Missing or invalid file', request_id: requestId }
      }, { status: 400 });
    }

    // Convert file to Buffer
    const arrayBuffer = await fileNode.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const reqCtx = createRequestContext({
      requestId,
      service: 'api',
    });

    const { token } = await context.params;

    const handlerReq = {
      params: { token },
      file: buffer,
      metadata: {
        kind,
        original_filename: fileNode.name,
      },
      context: reqCtx,
    };

    const deps = buildDeps();
    const result = await uploadDocumentHandler(handlerReq, deps);

    if (result.status >= 400 && result.body && result.body.error) {
      result.body.error.request_id = requestId;
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error('Unhandled upload document error:', err);
    const errorResponse = toErrorResponse(err);
    if (errorResponse.body && errorResponse.body.error) {
      (errorResponse.body.error as Record<string, unknown>).request_id = requestId;
    }
    return NextResponse.json(errorResponse.body, { status: errorResponse.status });
  }
}
