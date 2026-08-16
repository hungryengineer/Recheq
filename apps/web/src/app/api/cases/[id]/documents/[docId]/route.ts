import { NextResponse } from 'next/server';
import { repository } from '../../../../../lib/server/repository';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const params = await props.params;
    const documentId = params.docId;
    
    // Fetch the document content via the repository (from S3)
    const contentBuffer = await repository.getDocumentContent(documentId);
    
    if (!contentBuffer) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Document not found' } },
        { status: 404 }
      );
    }

    return new NextResponse(contentBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="document-${documentId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error serving document:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve document' } },
      { status: 500 }
    );
  }
}
