import type { RequestContext } from '../../observability/request-context.js';
import type { DocumentServiceDeps } from '../../services/documents/document-service.js';
import { uploadDocument } from '../../services/documents/document-service.js';
import type { TokenVerifier } from './token-auth.js';
import { resolveToken } from './token-auth.js';
import { toErrorResponse } from '../../http/errors.js';

// ─── POST /api/public/:token/documents ──────────────────────────
// Secure document upload with content sniffing and deduplication.

export interface DocumentUploadRequest {
  params: {
    token: string;
  };
  /** Raw file content as a Buffer */
  file: Buffer;
  /** Document metadata (kind, original_filename) */
  metadata: unknown;
  context: RequestContext;
}

export interface DocumentRouteDeps extends DocumentServiceDeps {
  tokenVerifier: TokenVerifier;
}

export async function uploadDocumentHandler(req: DocumentUploadRequest, deps: DocumentRouteDeps) {
  try {
    const caseId = await resolveToken(req.params.token, 'consent', deps.tokenVerifier);

    const result = await uploadDocument(caseId, req.file, req.metadata, deps);

    return {
      status: result.deduplicated ? 200 : 201,
      body: {
        data: result.document,
        deduplicated: result.deduplicated,
      },
    };
  } catch (err) {
    return toErrorResponse(err);
  }
}
