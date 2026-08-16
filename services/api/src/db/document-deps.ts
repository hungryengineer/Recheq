import { and, eq } from 'drizzle-orm';
import type { DocumentKind, DocumentRecord, DocumentStatus } from '@tieout/schema';
import type { DocumentServiceDeps } from '../services/documents/document-service.js';
import type { DocumentStorage } from '../storage/document-storage.js';
import type { Database } from './client.js';
import { getCaseRecordById } from './case-queries.js';
import { documents } from './schema/documents.js';

type DocumentRow = typeof documents.$inferSelect;

function toDocumentRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    case_id: row.case_id,
    kind: row.kind as DocumentKind,
    status: row.status as DocumentStatus,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    sha256: row.sha256,
    size_bytes: row.size_bytes,
    storage_path: row.storage_path,
    uploaded_at: row.uploaded_at.toISOString(),
  };
}

/**
 * Production adapter that backs the document service with the real database
 * and object storage.
 */
export function createDocumentDeps(db: Database, storage: DocumentStorage): DocumentServiceDeps {
  return {
    db: {
      getCaseById: (caseId) => getCaseRecordById(db, caseId),
      async getDocumentByCaseAndSha(caseId, sha256) {
        const rows = await db
          .select()
          .from(documents)
          .where(and(eq(documents.case_id, caseId), eq(documents.sha256, sha256)))
          .limit(1);
        return rows[0] ? toDocumentRecord(rows[0]) : null;
      },
      async createDocument(input) {
        const [row] = await db
          .insert(documents)
          .values({
            id: input.id,
            case_id: input.case_id,
            kind: input.kind,
            status: input.status,
            original_filename: input.original_filename,
            mime_type: input.mime_type,
            sha256: input.sha256,
            size_bytes: input.size_bytes,
            storage_path: input.storage_path,
          })
          .returning();
        if (!row) {
          throw new Error('createDocument failed: no row returned');
        }
        return toDocumentRecord(row);
      },
    },
    storage,
  };
}

/** Document kinds already provided for a case (drives the upload page). */
export async function listDocumentKindsByCase(
  db: Database,
  caseId: string,
): Promise<DocumentKind[]> {
  const rows = await db
    .select({ kind: documents.kind })
    .from(documents)
    .where(eq(documents.case_id, caseId));
  return rows.map((row) => row.kind as DocumentKind);
}
