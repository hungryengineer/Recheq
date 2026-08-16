// ─── Schema Validation and Retry Wrapper ───────────────────────
// Wrapper that adds schema validation and exactly one retry with validation error context

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from './llm-document-extractor.js';
import { PayslipExtraction, Form16Extraction } from '@tieout/schema';
import type { DocumentKind } from '@tieout/schema';
import { ExtractionError, ExtractionFailureType } from './llm-document-extractor.js';

/**
 * Wrapper that adds schema validation and exactly one retry with validation error context
 */
export class SchemaRetryWrapper implements LlmDocumentExtractor {
  readonly provider: string;
  readonly supportsStreaming: boolean;

  constructor(
    private readonly wrapped: LlmDocumentExtractor,
    private readonly maxRetries: number = 1,
  ) {
    this.provider = wrapped.provider;
    this.supportsStreaming = wrapped.supportsStreaming;
  }

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    return this.extractWithRetry(
      request,
      'payslip',
      this.wrapped.extractPayslip.bind(this.wrapped),
    );
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    return this.extractWithRetry(request, 'form16', this.wrapped.extractForm16.bind(this.wrapped));
  }

  getMetadata() {
    return this.wrapped.getMetadata();
  }

  async isAvailable(): Promise<boolean> {
    return this.wrapped.isAvailable();
  }

  private async extractWithRetry<T>(
    request: ExtractionRequest,
    kind: 'payslip' | 'form16',
    extractFn: (req: ExtractionRequest) => Promise<ExtractionResult<T>>,
  ): Promise<ExtractionResult<T>> {
    const maxAttempts = 1 + this.maxRetries; // Original + retries
    let lastValidationError = '';
    let lastRawOutput = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const isRetry = attempt > 0;
      const currentRequest = isRetry
        ? this.createRetryRequest(request, kind, lastValidationError, lastRawOutput)
        : request;

      const result = await extractFn(currentRequest);

      // If extraction failed, return immediately (no retry for non-schema failures)
      if (result.status === 'failure') {
        return result;
      }

      try {
        // Validate the extracted data against the schema
        this.validateExtraction(kind, result.data);

        // Successful extraction with valid schema
        return {
          ...result,
          retryCount: attempt,
        };
      } catch (validationError) {
        // Capture the validation error so the retry attempt can correct it
        lastValidationError =
          validationError instanceof Error ? validationError.message : String(validationError);
        lastRawOutput = result.rawOutput;

        // Schema validation failed
        if (attempt < maxAttempts - 1) {
          // Continue to next attempt (retry with validation error context)
          console.warn(
            `Schema validation failed for ${kind} document ${request.documentId}, retrying with error context:`,
            lastValidationError,
          );
          continue;
        } else {
          // No more retries available - mark as failure
          return {
            ...result,
            status: 'failure',
            error: `Schema validation failed after ${maxAttempts} attempts: ${lastValidationError}`,
            retryCount: attempt,
          };
        }
      }
    }

    // This should never happen due to the loop structure, but TypeScript needs it
    throw new ExtractionError(
      `Unexpected extraction state for ${kind} document ${request.documentId}`,
      ExtractionFailureType.SCHEMA_VALIDATION_FAILED,
      request.documentId,
      kind as DocumentKind,
      this.provider,
    );
  }

  private createRetryRequest(
    originalRequest: ExtractionRequest,
    kind: 'payslip' | 'form16',
    validationError: string,
    previousAttemptRawOutput: string,
  ): ExtractionRequest {
    // Surface the actual validation failure from the previous attempt so the
    // provider can correct the specific fields that failed validation.
    return {
      ...originalRequest,
      retryContext: {
        validationError,
        previousAttemptRawOutput,
      },
    };
  }

  private validateExtraction(kind: 'payslip' | 'form16', data: unknown): void {
    const kindLabel = kind === 'payslip' ? 'Payslip' : 'Form 16';
    const schema = kind === 'payslip' ? PayslipExtraction : Form16Extraction;

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue: { path: (string | number)[]; message: string }) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new Error(`${kindLabel} schema validation failed: ${detail}`);
    }
  }
}

/**
 * Create a SchemaRetryWrapper for any extractor
 */
export function withSchemaRetry(
  extractor: LlmDocumentExtractor,
  maxRetries: number = 1,
): LlmDocumentExtractor {
  return new SchemaRetryWrapper(extractor, maxRetries);
}
