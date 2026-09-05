// ─── LLM Document Extractor Interface ──────────────────────────
// Provider-independent interface for extracting structured data from documents
// All implementations must follow this contract

import type { DocumentKind } from '@recheq/schema';
import type { PayslipExtraction, Form16Extraction } from '@recheq/schema';

interface ExtractionResultBase {
  rawOutput: string;
  modelId: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  extractionDurationMs: number;
  retryCount: number;
}

export type ExtractionResult<T> =
  | (ExtractionResultBase & {
      status: 'success';
      data: T;
    })
  | (ExtractionResultBase & {
      status: 'failure';
      error: string;
    });

export interface ExtractionRequest {
  documentId: string;
  documentKind: DocumentKind;
  /**
   * Content of the document to extract from.
   *
   * Contract: the caller is responsible for extracting text out of the file
   * before invoking the extractor.
   * - `text/plain` and `application/pdf`: must be plain-text content. Raw
   *   Base64 PDF binary is NOT supported (it is gibberish to the LLM); use a
   *   PDF text-extraction step upstream.
   * - `image/*`: Base64-encoded image data, consumed via provider vision blocks.
   */
  documentContent: string;
  mimeType: string;
  schemaVersion: string;
  /** Retry context if this is a retry after schema validation failure */
  retryContext?: {
    validationError: string;
    previousAttemptRawOutput: string;
  };
}

/**
 * Base interface for all LLM-based document extractors
 * Provider implementations must implement this interface
 */
export interface LlmDocumentExtractor {
  readonly provider: string;
  readonly supportsStreaming: boolean;

  /**
   * Extract structured data from a payslip document
   * Returns null for missing/illegible values, never computes arithmetic
   */
  extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>>;

  /**
   * Extract structured data from a Form 16 document
   * Returns null for missing/illegible values, never computes arithmetic
   */
  extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>>;

  /**
   * Get provider metadata including costs, rate limits, etc.
   */
  getMetadata(): {
    maxContentSize: number;
    supportsImages: boolean;
    supportsPdfText: boolean;
    costPer1kTokens: number;
  };

  /**
   * Check if the provider is available/healthy
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Types of extraction failures
 */
export enum ExtractionFailureType {
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',
  UNSUPPORTED_DOCUMENT = 'UNSUPPORTED_DOCUMENT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Common extraction errors
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly failureType: ExtractionFailureType,
    public readonly documentId: string,
    public readonly documentKind: DocumentKind,
    public readonly provider?: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Schema validation error (for retry handling)
 */
export class SchemaValidationError extends ExtractionError {
  constructor(
    message: string,
    documentId: string,
    documentKind: DocumentKind,
    public readonly validationError: string,
    provider?: string,
  ) {
    super(
      message,
      ExtractionFailureType.SCHEMA_VALIDATION_FAILED,
      documentId,
      documentKind,
      provider,
    );
    this.name = 'SchemaValidationError';
  }
}

/**
 * Provider unavailable error
 */
export class ProviderUnavailableError extends ExtractionError {
  constructor(message: string, documentId: string, documentKind: DocumentKind, provider?: string) {
    super(message, ExtractionFailureType.PROVIDER_UNAVAILABLE, documentId, documentKind, provider);
    this.name = 'ProviderUnavailableError';
  }
}
