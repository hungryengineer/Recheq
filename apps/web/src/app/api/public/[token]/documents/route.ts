import { NextResponse } from 'next/server';
import { uploadDocumentHandler, toErrorResponse } from '@tieout/api/web';
import { getDocumentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';

/** Must stay in sync with the service-layer MAX_UPLOAD_BYTES (10 MB). */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let file: File | null = null;
  let kind: unknown = null;

  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');

    // In Next.js App Router, formData.get() returns an object that implements File/Blob but might fail `instanceof File`.
    // The safest cross-runtime check is looking for a string name and arrayBuffer method.
    if (fileEntry && typeof fileEntry === 'object' && 'arrayBuffer' in fileEntry) {
      file = fileEntry as File;
    }

    kind = formData.get('kind') ?? null;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ success: false, message: 'Missing file' }, { status: 400 });
  }

  // Validate size before reading the full body into memory.
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { success: false, message: 'File exceeds the 10 MB limit' },
      { status: 413 },
    );
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

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
