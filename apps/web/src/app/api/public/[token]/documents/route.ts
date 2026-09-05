import { NextResponse } from 'next/server';
import { uploadDocumentHandler, toErrorResponse } from '@recheq/api/web';
import { getDocumentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';
import { toPublicHandler } from '@/lib/server/adapter';

/** Must stay in sync with the service-layer MAX_UPLOAD_BYTES (10 MB). */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const POST = toPublicHandler(async (req: { raw: Request, params: { token: string } }) => {
  const token = req.params.token;
  const request = req.raw;
  let file: File | null = null;
  let kind: unknown = null;

  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');

    const isFileLike = (val: unknown): val is File => {
      if (val === null || typeof val !== 'object') return false;
      const record = val as Record<string, unknown>;
      return (
        'name' in record &&
        typeof record.name === 'string' &&
        'size' in record &&
        typeof record.size === 'number' &&
        'arrayBuffer' in record &&
        typeof record.arrayBuffer === 'function'
      );
    };

    if (isFileLike(fileEntry)) {
      file = fileEntry;
    }

    kind = formData.get('kind') ?? null;
  } catch {
    return { status: 400, body: { success: false, message: 'Invalid request body' } };
  }

  if (!file) {
    return { status: 400, body: { success: false, message: 'Missing file' } };
  }

  // Validate size before reading the full body into memory.
  if (file.size > MAX_UPLOAD_BYTES) {
    return { status: 413, body: { success: false, message: 'File exceeds the 10 MB limit' } };
  }

  try {
    const result = await uploadDocumentHandler(
      {
        params: { token },
        file: Buffer.from(await file.arrayBuffer()),
        metadata: { kind, original_filename: file.name },
        context: createRequestContext(),
      },
      {
        ...getDocumentDeps(),
        tokenVerifier: getTokenVerifier(),
      },
    );

    return result;
  } catch (error) {
    return toErrorResponse(error);
  }
});
