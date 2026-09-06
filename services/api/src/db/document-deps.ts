import { and, eq } from 'drizzle-orm';
import { DocumentKind, DocumentStatus, type DocumentRecord } from '@recheq/schema';
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
    kind: DocumentKind.parse(row.kind),
    status: DocumentStatus.parse(row.status),
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
        try {
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
        } catch (err: unknown) {
          // Postgres unique-violation code: 23505
          // Catches the uq_documents_case_sha256 constraint race where a
          // concurrent upload committed between our dedup check and this insert.
          // The Postgres error may be wrapped by Drizzle, so check both err.code
          // and err.cause.code to handle both cases.
          const directCode =
            typeof err === 'object' && err !== null && 'code' in err && err.code === '23505';
          const wrappedCode =
            typeof err === 'object' &&
            err !== null &&
            'cause' in err &&
            typeof err.cause === 'object' &&
            err.cause !== null &&
            'code' in err.cause &&
            err.cause.code === '23505';
          const isUniqueViolation = directCode || wrappedCode;

          if (isUniqueViolation) {
            const existing = await db
              .select()
              .from(documents)
              .where(and(eq(documents.case_id, input.case_id), eq(documents.sha256, input.sha256)))
              .limit(1);
            if (existing[0]) {
              // A concurrent upload won the race: our object at input.storage_path
              // is now orphaned. Delete it so no garbage accumulates in the bucket.
              await storage.deleteObject(input.storage_path);
              return toDocumentRecord(existing[0]);
            }
          }
          throw err;
        }
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
  return rows.map((row) => DocumentKind.parse(row.kind));
}
