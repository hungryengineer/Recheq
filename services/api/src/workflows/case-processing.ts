import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { cases, documents, extractions } from '../db/schema/index.js';
import { createLogger } from '../observability/logger.js';
import type { RequestContext } from '../observability/request-context.js';

export interface ExtractionProvider {
  extractPayslip: (doc: {
    id: string;
    content: string;
  }) => Promise<{ data: unknown; usage: unknown }>;
  extractForm16: (doc: {
    id: string;
    content: string;
  }) => Promise<{ data: unknown; usage: unknown }>;
}

export interface CaseProcessingDeps {
  db: Database;
  extractor: ExtractionProvider;
  /** Resolves the raw document content for extraction (e.g. read from object storage). */
  getContent: (documentId: string, storagePath: string) => Promise<string>;
}

const logger = createLogger();

function context(caseId: string): RequestContext {
  return {
    requestId: randomUUID(),
    service: 'case-processing',
    startedAtMs: Date.now(),
    caseId,
  };
}

export async function updateExtractionSuccess(
  db: CaseProcessingDeps['db'],
  extId: string,
  data: unknown,
): Promise<void> {
  await db
    .update(extractions)
    .set({
      extracted_data: data,
      status: 'completed',
      completed_at: new Date(),
    })
    .where(eq(extractions.id, extId));
}

export async function updateExtractionFailure(
  db: CaseProcessingDeps['db'],
  extId: string,
  error: string,
): Promise<void> {
  await db
    .update(extractions)
    .set({
      status: 'failed',
      error_message: error,
      completed_at: new Date(),
    })
    .where(eq(extractions.id, extId));
}

export async function processCase(deps: CaseProcessingDeps, caseId: string): Promise<void> {
  const db = deps.db;

  const caseRecord = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);

  if (!caseRecord.length) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const docs = await db.select().from(documents).where(eq(documents.case_id, caseId));

  await Promise.all(
    docs.map(async (doc) => {
      try {
        const content = await deps.getContent(doc.id, doc.storage_path);
        let result;
        if (doc.kind === 'payslip') {
          result = await deps.extractor.extractPayslip({
            id: doc.id,
            content,
          });
        } else if (doc.kind === 'form16') {
          result = await deps.extractor.extractForm16({
            id: doc.id,
            content,
          });
        } else {
          throw new Error(`Unknown document type: ${doc.kind}`);
        }

        await updateExtractionSuccess(db, doc.id, result.data);
        logger.info('extraction succeeded', context(caseId), { docId: doc.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
          await updateExtractionFailure(db, doc.id, msg);
          logger.warn('extraction failed', context(caseId), { docId: doc.id, error: msg });
        } catch (dbErr) {
          logger.fatal('failed to record extraction failure', context(caseId), {
            docId: doc.id,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
        }
      }
    }),
  );

  logger.info('case processing completed', context(caseId));
}
