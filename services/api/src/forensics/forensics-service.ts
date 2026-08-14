/**
 * Forensics service for PDF inspection.
 * Provides functions to create and update forensics records in the database.
 * Follows the extraction-service pattern: async functions, Drizzle ORM, error throwing.
 */

import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { forensics } from '../db/schema/forensics.js';
import type { FontRunAnalysis } from './font-runs.js';
import type { MonetaryAnomalyAnalysis } from './monetary-anomalies.js';
import type { PdfMetadata } from './pdf-metadata.js';

/**
 * Represents the complete forensics data collected from a PDF.
 * All fields are safe to log: no raw document content.
 */
export interface ForensicsData {
  producer: string | null;
  creator: string | null;
  creation_date: Date | null;
  modification_date: Date | null;
  font_runs: FontRunAnalysis | null;
  monetary_anomalies: MonetaryAnomalyAnalysis | null;
}

/**
 * Creates a new pending forensics record for a document.
 * Called when a document is uploaded to initiate async PDF inspection.
 *
 * @param db - Database instance
 * @param documentId - ID of the document to inspect
 * @returns Forensics record ID
 * @throws If database insertion fails
 */
export async function createForensicsRecord(
  db: Database,
  documentId: string,
): Promise<string> {
  const [record] = await db
    .insert(forensics)
    .values({
      document_id: documentId,
      status: 'pending',
    })
    .returning({ id: forensics.id });

  if (!record) {
    throw new Error('Failed to create forensics record');
  }

  return record.id;
}

/**
 * Updates a forensics record with successful inspection results.
 * Called after PDF inspection completes successfully.
 *
 * @param db - Database instance
 * @param forensicsId - ID of the forensics record to update
 * @param metadata - Extracted PDF metadata (producer, creator, dates)
 * @param fontRuns - Aggregated font analysis (safe aggregation, no character details)
 * @param monetaryAnomalies - Monetary anomaly flags and confidence (no raw text)
 * @throws If database update fails
 */
export async function updateForensicsSuccess(
  db: Database,
  forensicsId: string,
  data: {
    metadata: PdfMetadata;
    fontRuns: FontRunAnalysis | null;
    monetaryAnomalies: MonetaryAnomalyAnalysis | null;
  },
): Promise<void> {
  await db
    .update(forensics)
    .set({
      producer: data.metadata.producer,
      creator: data.metadata.creator,
      creation_date: data.metadata.creation_date,
      modification_date: data.metadata.modification_date,
      font_runs: data.fontRuns,
      monetary_anomalies: data.monetaryAnomalies,
      status: 'completed',
      completed_at: new Date(),
    })
    .where(eq(forensics.id, forensicsId));
}

/**
 * Updates a forensics record with failure details.
 * Called when PDF inspection fails (corrupt PDF, read error, etc.).
 * Gracefully degrades: marks as 'not_assessed' rather than throwing.
 *
 * @param db - Database instance
 * @param forensicsId - ID of the forensics record to update
 * @param errorMessage - Brief error description (no raw PDF content)
 * @throws If database update fails
 */
export async function updateForensicsFailure(
  db: Database,
  forensicsId: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(forensics)
    .set({
      status: 'not_assessed',
      // Store error message in metadata_raw as informational only
      metadata_raw: {
        error: errorMessage,
        inspected_at: new Date().toISOString(),
      },
      completed_at: new Date(),
    })
    .where(eq(forensics.id, forensicsId));
}

/**
 * Retrieve a forensics record by document ID.
 * Returns null if no record exists (document not inspected yet).
 *
 * @param db - Database instance
 * @param documentId - Document ID to look up
 * @returns Forensics record or null
 * @throws If database query fails
 */
export async function getForensicsByDocumentId(
  db: Database,
  documentId: string,
): Promise<
  (typeof forensics.$inferSelect & {
    font_runs: FontRunAnalysis | null;
    monetary_anomalies: MonetaryAnomalyAnalysis | null;
  }) | null
> {
  const result = await db.query.forensics.findFirst({
    where: eq(forensics.document_id, documentId),
  });

  return result ?? null;
}

/**
 * Retrieve all forensics records for a case (via joining with documents table).
 * Used to assemble evidence after all documents are inspected.
 *
 * @param db - Database instance
 * @param _caseId - Case ID to retrieve forensics for
 * @returns Array of forensics records
 * @throws If database query fails
 *
 * @note Implementation requires JOIN with documents table on case_id
 */
export async function getForensicsByCase(
  db: Database,
  _caseId: string,
): Promise<
  Array<
    typeof forensics.$inferSelect & {
      font_runs: FontRunAnalysis | null;
      monetary_anomalies: MonetaryAnomalyAnalysis | null;
      document_id: string;
    }
  >
> {
  // Note: This requires a JOIN with the documents table to filter by case_id
  // Implementation depends on how your db query system handles relationships
  const result = await db.query.forensics.findMany({
    // Pseudo-code: where(eq(documents.case_id, caseId))
    // In practice, you'd add a WHERE clause that joins documents
  });

  return result ?? [];
}
