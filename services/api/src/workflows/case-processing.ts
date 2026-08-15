import type { getDbConnection } from '../db/client.js';
import { logger } from '../observability/logger.js';
import { cases, extractions } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

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
  db: Awaited<ReturnType<typeof getDbConnection>>;
  extractor: ExtractionProvider;
}

export async function updateExtractionSuccess(
  db: CaseProcessingDeps['db'],
  extId: string,
  data: unknown,
): Promise<void> {
  await db
    .update(extractions)
    .set({
      data,
      status: 'success',
      updated_at: new Date(),
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
      error,
      updated_at: new Date(),
    })
    .where(eq(extractions.id, extId));
}

export async function processCase(deps: CaseProcessingDeps, caseId: string): Promise<void> {
  const db = deps.db;

  const caseRecord = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);

  if (!caseRecord.length) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const docs = await db.select().from(extractions).where(eq(extractions.case_id, caseId));

  await Promise.all(
    docs.map(async (doc) => {
      try {
        let result;
        if (doc.document_type === 'payslip') {
          result = await deps.extractor.extractPayslip({
            id: doc.id,
            content: doc.raw_content || '',
          });
        } else if (doc.document_type === 'form16') {
          result = await deps.extractor.extractForm16({
            id: doc.id,
            content: doc.raw_content || '',
          });
        } else {
          throw new Error(`Unknown document type: ${doc.document_type}`);
        }

        await updateExtractionSuccess(db, doc.id, result.data);
        logger.info('extraction succeeded', { caseId, docId: doc.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
          await updateExtractionFailure(db, doc.id, msg);
          logger.warn('extraction failed', { caseId, docId: doc.id, error: msg });
        } catch (dbErr) {
          logger.fatal('failed to record extraction failure', {
            caseId,
            docId: doc.id,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
        }
      }
    }),
  );

  logger.info('case processing completed', { caseId });
}
