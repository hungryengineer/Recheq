/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { type VerificationStep, type StepResult, RecoverableWorkflowError } from '@tieout/workflow';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';


import {
  ExtractionFailureType,
  ExtractionError,
  ProviderUnavailableError,
} from '../../extraction/llm-document-extractor.js';

import type { CaseStepContext } from '../case-processing.js';

export class ExtractionStep implements VerificationStep<
  CaseStepContext,
  {
    extractedCount: number;
    failedCount: number;
  }
> {
  readonly id = 'doc.extract';
  readonly label = 'Document Extraction';
  readonly speed = 'fast';
  readonly timeoutMs = 60000;
  readonly dependsOn = [];

  readonly dataSource = {
    source: 'derived',
    licence: 'none',
  };

  requires(_ctx: CaseStepContext): boolean {
    return true;
  }

  async run(
    ctx: CaseStepContext,
  ): Promise<StepResult<{ extractedCount: number; failedCount: number }>> {
    const { caseId, deps } = ctx;
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

    const documentsToExtract = documents.filter((doc) => !extractedDocIds.has(doc.id));

    // Process extractions in chunks of 3 to bound concurrency
    const concurrencyLimit = 3;
    for (let i = 0; i < documentsToExtract.length; i += concurrencyLimit) {
      const chunk = documentsToExtract.slice(i, i + concurrencyLimit);

      await Promise.all(
        chunk.map(async (doc) => {
          let extId: string | undefined;
          try {
            const isValidKind = (k: string): k is 'payslip' | 'form_16' =>
              k === 'payslip' || k === 'form_16';

            if (!isValidKind(doc.kind)) {
              throw new Error(`Unsupported document kind: ${doc.kind}`);
            }

            const kind = doc.kind;

            // Create pending extraction
            extId = await deps.db.createExtraction(doc.id, {
              modelId: 'default',
              schemaVersion: kind === 'payslip' ? 'payslip-v1' : 'form16-v1',
            });

            const docContent = await deps.db.getDocumentContent(doc.id);

            let finalContent: string;
            let finalMime = docContent.mimeType;

            if (deps.extractor.provider === 'gemini') {
              finalContent = docContent.content.toString('base64');
            } else {
              if (docContent.mimeType === 'application/pdf') {
                const parsed = await pdfParse(docContent.content);
                finalContent = parsed.text;
                finalMime = 'text/plain';
              } else {
                finalContent = docContent.content.toString('utf8');
              }
            }

            const req = {
              documentId: doc.id,
              documentKind: kind,
              documentContent: finalContent,
              mimeType: finalMime,
              schemaVersion: kind === 'payslip' ? ('payslip-v1' as const) : ('form16-v1' as const),
            };

            const result =
              kind === 'payslip'
                ? await deps.extractor.extractPayslip(req)
                : await deps.extractor.extractForm16(req);

            if (result.status === 'success') {
              await deps.db.updateExtractionSuccess(extId, result.data, result.usage);
              extractedCount++;
            } else {
              await deps.db.updateExtractionFailure(extId, result.error);
              failedCount++;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (
              err instanceof ProviderUnavailableError ||
              (err instanceof ExtractionError &&
                err.failureType === ExtractionFailureType.RATE_LIMITED)
            ) {
              if (extId) {
                try {
                  await deps.db.updateExtractionFailure(extId, msg);
                } catch (dbErr) {
                  console.error(
                    `Failed to record transient extraction failure for doc ${doc.id}:`,
                    dbErr,
                  );
                }
              }
              // Do not swallow transient infrastructure errors - fail job for retry
              throw new RecoverableWorkflowError(
                'Extraction provider unavailable or rate limited',
                err,
              );
            }

            failedCount++;
            if (extId) {
              try {
                await deps.db.updateExtractionFailure(extId, msg);
              } catch (dbErr) {
                console.error(`Failed to record extraction failure for doc ${doc.id}:`, dbErr);
              }
            } else {
              console.error(`Failed to extract doc ${doc.id} before initialization:`, msg);
            }
          }
        }),
      );
    }

    const allFailed = extractedCount === 0 && failedCount > 0;

    return {
      state: allFailed ? 'failed' : 'succeeded',
      artifact: allFailed ? null : { extractedCount, failedCount },
      reason: failedCount > 0 ? `Completed with ${failedCount} failures` : null,
      provenance: { source: 'derived', model: 'system', licence: 'none' },
      startedAt,
      completedAt: new Date(),
    };
  }
}
