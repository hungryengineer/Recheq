// ─── Schema Validation and Retry Wrapper ───────────────────────
// Wrapper that adds schema validation and exactly one retry with validation error context

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from './llm-document-extractor.js';
import type { DocumentKind, PayslipExtraction, Form16Extraction } from '@tieout/schema';
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
    try {
      if (kind === 'payslip') {
        // Import the actual schema - for now using a basic validation
        // In the real implementation, we would import and use the actual zod schemas
        this.validatePayslipStructure(data);
      } else {
        this.validateForm16Structure(data);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${kindLabel} schema validation failed: ${detail}`);
    }
  }

  private validatePayslipStructure(data: unknown): void {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Payslip extraction must be an object');
    }

    const record = data as Record<string, unknown>;

    // Check required structure (allowing null values as per spec)
    const requiredFields = [
      'employee_name',
      'employer_name',
      'month',
      'year',
      'basic_raw_label',
      'basic',
      'hra',
      'da',
      'special_allowance',
      'other_allowances',
      'gross_salary',
      'pf_deduction',
      'professional_tax',
      'income_tax',
      'other_deductions',
      'total_deductions',
      'net_salary',
      'extraction_notes',
    ];

    for (const field of requiredFields) {
      if (!(field in record)) {
        throw new Error(`Missing field: ${field}`);
      }
    }

    // Validate specific types (allow null values)
    if (record.employee_name !== null && typeof record.employee_name !== 'string') {
      throw new Error('employee_name must be string or null');
    }
    if (record.employer_name !== null && typeof record.employer_name !== 'string') {
      throw new Error('employer_name must be string or null');
    }
    if (record.month !== null && typeof record.month !== 'string') {
      throw new Error('month must be string or null');
    }
    if (
      record.year !== null &&
      (typeof record.year !== 'number' || !Number.isInteger(record.year))
    ) {
      throw new Error('year must be integer or null');
    }
    if (record.basic_raw_label !== null && typeof record.basic_raw_label !== 'string') {
      throw new Error('basic_raw_label must be string or null');
    }

    // Validate all numeric fields allow null
    const numericFields = [
      'basic',
      'hra',
      'da',
      'special_allowance',
      'other_allowances',
      'gross_salary',
      'pf_deduction',
      'professional_tax',
      'income_tax',
      'other_deductions',
      'total_deductions',
      'net_salary',
    ];

    for (const field of numericFields) {
      const value = record[field];
      if (value !== null && typeof value !== 'number') {
        throw new Error(`${field} must be number or null`);
      }
    }

    if (record.extraction_notes !== null && typeof record.extraction_notes !== 'string') {
      throw new Error('extraction_notes must be string or null');
    }
  }

  private validateForm16Structure(data: unknown): void {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Form 16 extraction must be an object');
    }

    const record = data as Record<string, unknown>;

    // Check required structure (allowing null values as per spec)
    const requiredFields = [
      'employee_name',
      'employer_name',
      'pan',
      'tan',
      'financial_year',
      'assessment_year',
      'gross_total_income',
      'total_tax_deducted',
      'total_salary',
      'extraction_notes',
    ];

    for (const field of requiredFields) {
      if (!(field in record)) {
        throw new Error(`Missing field: ${field}`);
      }
    }

    // Validate string fields (allow null)
    const stringFields = [
      'employee_name',
      'employer_name',
      'pan',
      'tan',
      'financial_year',
      'assessment_year',
      'extraction_notes',
    ];

    for (const field of stringFields) {
      const value = record[field];
      if (value !== null && typeof value !== 'string') {
        throw new Error(`${field} must be string or null`);
      }
    }

    // Validate numeric fields (allow null)
    const numericFields = ['gross_total_income', 'total_tax_deducted', 'total_salary'];
    for (const field of numericFields) {
      const value = record[field];
      if (value !== null && typeof value !== 'number') {
        throw new Error(`${field} must be number or null`);
      }
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
