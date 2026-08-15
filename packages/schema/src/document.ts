import { z } from 'zod';
import { DocumentKind, DocumentStatus } from './enums.js';

// ─── Document Record ────────────────────────────────────────────
export const DocumentRecord = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  kind: DocumentKind,
  status: DocumentStatus,
  /** Original filename as uploaded by the candidate */
  original_filename: z.string(),
  /** MIME type determined from content sniffing, not extension */
  mime_type: z.string(),
  /** SHA-256 hash of the file content */
  sha256: z.string().length(64),
  /** File size in bytes */
  size_bytes: z.number().int().positive(),
  /** Storage path (private, never exposed to client) */
  storage_path: z.string(),
  uploaded_at: z.string().datetime(),
});
export type DocumentRecord = z.infer<typeof DocumentRecord>;

// ─── Document Upload Input ──────────────────────────────────────
export const DocumentUploadInput = z.object({
  /** Type of document being uploaded */
  kind: DocumentKind,
  /** Original filename as provided by the uploader */
  original_filename: z.string().min(1).max(500),
});
export type DocumentUploadInput = z.infer<typeof DocumentUploadInput>;
