import type { VerificationStep, StepResult } from '@tieout/workflow';
import type { CaseProcessingDeps } from '../case-processing.js';
import {
  createExtraction,
  updateExtractionSuccess,
  updateExtractionFailure,
} from '../../extraction/extraction-service.js';
import {
  ExtractionFailureType,
  ExtractionError,
  ProviderUnavailableError,
} from '../../extraction/llm-document-extractor.js';

export interface CaseStepContext {
  caseId: string;
  deps: CaseProcessingDeps;
  signal?: AbortSignal;
}

export class ExtractionStep implements VerificationStep<{
  extractedCount: number;
  failedCount: number;
}> {
  readonly id = 'doc.extract';
  readonly label = 'Document Extraction';
  readonly speed = 'fast';
  readonly timeoutMs = 60000;
  readonly dependsOn = [];

  readonly dataSource = {
    source: 'derived',
    licence: 'none',
  };

  requires(_ctx: unknown): boolean {
    return true;
  }

  async run(ctx: unknown): Promise<StepResult<{ extractedCount: number; failedCount: number }>> {
    const context = ctx as CaseStepContext;
    const { caseId, deps } = context;
    const startedAt = new Date();

    const documents = await deps.db.getDocumentsForCase(caseId);
    if (documents.length === 0) {
      return {
        state: 'succeeded',
        artifact: { extractedCount: 0, failedCount: 0 },
        reason: 'No documents to extract',
        provenance: { source: 'derived', model: 'system', licence: 'none' },
        startedAt,
        completedAt: new Date(),
      };
    }

    const docIds = documents.map((d) => d.id);
    const existingExtractions = await deps.db.getSuccessfulExtractions(docIds);
    const extractedDocIds = new Set(existingExtractions.map((e) => e.document_id));

    let extractedCount = 0;
    let failedCount = 0;

    const extractionPromises = documents
      .filter((doc) => !extractedDocIds.has(doc.id))
      .map(async (doc) => {
        // Create pending extraction
        const extId = await createExtraction(deps.db, doc.id, {
          modelId: 'default',
          schemaVersion: doc.kind === 'payslip' ? 'payslip-v1' : 'form16-v1',
        });

        try {
          const docContent = await deps.db.getDocumentContent(doc.id);

          const req = {
            documentId: doc.id,
            documentKind: doc.kind as 'payslip' | 'form_16',
            documentContent: docContent.content,
            mimeType: docContent.mimeType,
            schemaVersion: doc.kind === 'payslip' ? 'payslip-v1' : 'form16-v1',
          };

          const result =
            doc.kind === 'payslip'
              ? await deps.extractor.extractPayslip(req)
              : await deps.extractor.extractForm16(req);

          if (result.status === 'success') {
            await updateExtractionSuccess(deps.db, extId, result.data, result.usage);
            extractedCount++;
          } else {
            await updateExtractionFailure(deps.db, extId, result.error);
            failedCount++;
          }
        } catch (err) {
          if (
            err instanceof ProviderUnavailableError ||
            (err instanceof ExtractionError &&
              err.failureType === ExtractionFailureType.RATE_LIMITED)
          ) {
            // Do not swallow transient infrastructure errors - fail job for retry
            throw err;
          }
          const msg = err instanceof Error ? err.message : String(err);
          failedCount++;
          try {
            await updateExtractionFailure(deps.db, extId, msg);
          } catch (dbErr) {
            console.error(`Failed to record extraction failure for doc ${doc.id}:`, dbErr);
          }
        }
      });

    await Promise.all(extractionPromises);

    return {
      state: 'succeeded',
      artifact: { extractedCount, failedCount },
      reason: failedCount > 0 ? `Completed with ${failedCount} failures` : null,
      provenance: { source: 'derived', model: 'system', licence: 'none' },
      startedAt,
      completedAt: new Date(),
    };
  }
}
