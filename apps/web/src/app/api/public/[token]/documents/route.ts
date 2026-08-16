import { NextResponse } from 'next/server';
import { uploadDocumentHandler } from '@tieout/api/web';
import { getDocumentDeps, getTokenVerifier, createRequestContext } from '@/lib/api/public';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let file: File | null = null;
  let kind: unknown = null;

  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    if (fileEntry instanceof File) {
      file = fileEntry;
    }
    kind = formData.get('kind') ?? null;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ success: false, message: 'Missing file' }, { status: 400 });
  }

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
}
