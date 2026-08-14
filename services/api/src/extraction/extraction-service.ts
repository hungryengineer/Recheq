import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { extractions } from '../db/schema/extractions.js';
import type { ExtractionMetadata, TokenUsage } from './types.js';

/**
 * Creates a new pending extraction record for a document.
 */
export async function createExtraction(
  db: Database,
  documentId: string,
  metadata: ExtractionMetadata,
): Promise<string> {
  const [record] = await db
    .insert(extractions)
    .values({
      document_id: documentId,
      model_id: metadata.modelId,
      schema_version: metadata.schemaVersion,
      status: 'pending',
    })
    .returning({ id: extractions.id });

  if (!record) {
    throw new Error('Failed to create extraction record');
  }

  const recordId = record.id;
  return recordId;
}

/**
 * Updates an extraction record with successful extraction data.
 */
export async function updateExtractionSuccess<T>(
  db: Database,
  extractionId: string,
  data: T,
  tokenUsage?: TokenUsage,
): Promise<void> {
  await db
    .update(extractions)
    .set({
      status: 'completed',
      extracted_data: data,
      token_usage: tokenUsage,
      completed_at: new Date(),
    })
    .where(eq(extractions.id, extractionId));
}

/**
 * Updates an extraction record with failure details, ensuring we do not
 * silently create a successful empty extraction.
 */
export async function updateExtractionFailure(
  db: Database,
  extractionId: string,
  errorMessage: string,
  tokenUsage?: TokenUsage,
): Promise<void> {
  await db
    .update(extractions)
    .set({
      status: 'failed',
      error_message: errorMessage,
      token_usage: tokenUsage,
      completed_at: new Date(),
    })
    .where(eq(extractions.id, extractionId));
}
