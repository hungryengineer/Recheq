import crypto from 'node:crypto';
import type { CaseRecord, DocumentRecord } from '@tieout/schema';
import { DocumentUploadInput as DocumentUploadInputSchema } from '@tieout/schema';
import { validationError, notFoundError } from '../../http/errors.js';
import { sniffMimeType, isAllowedMimeType } from './mime-sniffer.js';

// ─── Constants ──────────────────────────────────────────────────

/** Maximum upload size: 10 MB */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// ─── Service Dependencies ───────────────────────────────────────

export interface DocumentServiceDeps {
  db: {
    getCaseById: (caseId: string) => Promise<CaseRecord | null>;
    getDocumentByCaseAndSha: (caseId: string, sha256: string) => Promise<DocumentRecord | null>;
    createDocument: (input: Omit<DocumentRecord, 'uploaded_at'>) => Promise<DocumentRecord>;
  };
  storage: {
    putObject: (key: string, content: Buffer, contentType: string) => Promise<void>;
  };
  forensics?: {
    createRecord: (documentId: string) => Promise<string>;
  };
}

// ─── Upload Result ──────────────────────────────────────────────

export interface UploadResult {
  document: DocumentRecord;
  /** True if the document was a duplicate and no new record was created */
  deduplicated: boolean;
}

// ─── Upload Document ────────────────────────────────────────────

/**
 * Processes a secure document upload:
 * 1. Validates file size (≤ 10 MB)
 * 2. Sniffs MIME type from content (not extension)
 * 3. Validates MIME type against allowed types
 * 4. Computes SHA-256 hash
 * 5. Checks for duplicate (same case + SHA-256)
 * 6. Stores file in private bucket under {org_id}/{case_id}/{document_id}.{ext}
 * 7. Creates document record
 */
export async function uploadDocument(
  caseId: string,
  content: Buffer,
  metadata: unknown,
  deps: DocumentServiceDeps,
): Promise<UploadResult> {
  // ── 1. Validate metadata schema ───────────────────────────────
  const parsed = DocumentUploadInputSchema.safeParse(metadata);
  if (!parsed.success) {
    throw validationError('Invalid document metadata', parsed.error.errors);
  }
  const { kind, original_filename } = parsed.data;

  // ── 2. Validate file size ─────────────────────────────────────
  if (content.length === 0) {
    throw validationError('File content is empty');
  }
  if (content.length > MAX_UPLOAD_BYTES) {
    throw validationError(
      `File size ${content.length} bytes exceeds the maximum of ${MAX_UPLOAD_BYTES} bytes (10 MB)`,
    );
  }

  // ── 3. Sniff MIME type from content ───────────────────────────
  const mimeResult = sniffMimeType(content);
  if (!mimeResult) {
    throw validationError('Unable to determine file type from content');
  }
  if (!isAllowedMimeType(mimeResult.mimeType)) {
    throw validationError(
      `Unsupported file type: ${mimeResult.mimeType}. Allowed types: application/pdf, image/jpeg, image/png`,
    );
  }

  // ── 4. Get case and validate state ────────────────────────────
  const caseRecord = await deps.db.getCaseById(caseId);
  if (!caseRecord) {
    throw notFoundError('Case not found');
  }
  if (caseRecord.status !== 'awaiting_documents') {
    throw validationError(
      `Cannot upload documents: case status is "${caseRecord.status}", expected "awaiting_documents"`,
    );
  }

  // ── 5. Compute SHA-256 ────────────────────────────────────────
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');

  // ── 6. Check for duplicate ────────────────────────────────────
  const existing = await deps.db.getDocumentByCaseAndSha(caseId, sha256);
  if (existing) {
    return { document: existing, deduplicated: true };
  }

  // ── 7. Store file in private bucket ───────────────────────────
  const documentId = crypto.randomUUID();
  const storagePath = `${caseRecord.org_id}/${caseId}/${documentId}.${mimeResult.extension}`;

  await deps.storage.putObject(storagePath, content, mimeResult.mimeType);

  // ── 8. Create document record ─────────────────────────────────
  const document = await deps.db.createDocument({
    id: documentId,
    case_id: caseId,
    kind,
    status: 'pending',
    original_filename,
    mime_type: mimeResult.mimeType,
    sha256,
    size_bytes: content.length,
    storage_path: storagePath,
  });

  // ── 9. Initiate forensics for PDFs ──────────────────────────────
  if (mimeResult.mimeType === 'application/pdf' && deps.forensics) {
    try {
      await deps.forensics.createRecord(document.id);
    } catch (err) {
      console.error(`Failed to initiate forensics for document ${document.id}`, err);
    }
  }

  return { document, deduplicated: false };
}
