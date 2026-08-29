// ─── Regex fallback wrapper ───────────────────────────────────────
// Generalises the GeminiWithFallback pattern: wraps any primary extractor
// (LLM + schema-retry) and, when the primary produces a final failure,
// tries the deterministic RegexDocumentExtractor so a hard provider outage
// never collapses an entire case into "no evidence / no findings".
//
// The provider property is delegated to the primary so the upstream
// extraction step keeps sending the input format the primary expects.

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';
import { RegexDocumentExtractor } from './regex-extractor.js';

function failureResult<T>(error: string): ExtractionResult<T> {
  return {
    status: 'failure',
    error,
    rawOutput: '',
    modelId: 'regex-fallback:primary-error',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    extractionDurationMs: 0,
    retryCount: 1,
  };
}

export class RegexFallbackExtractor implements LlmDocumentExtractor {
  readonly provider: string;
  readonly supportsStreaming: boolean;

  constructor(
    private readonly primary: LlmDocumentExtractor,
    private readonly regex: LlmDocumentExtractor = new RegexDocumentExtractor(),
  ) {
    this.provider = primary.provider;
    this.supportsStreaming = primary.supportsStreaming;
  }

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    return this.withFallback(
      request,
      () => this.primary.extractPayslip(request),
      (req) => this.regex.extractPayslip(req),
    );
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    return this.withFallback(
      request,
      () => this.primary.extractForm16(request),
      (req) => this.regex.extractForm16(req),
    );
  }

  getMetadata() {
    return this.primary.getMetadata();
  }

  async isAvailable(): Promise<boolean> {
    return this.primary.isAvailable();
  }

  private async withFallback<T>(
    request: ExtractionRequest,
    primary: (req: ExtractionRequest) => Promise<ExtractionResult<T>>,
    regex: (req: ExtractionRequest) => Promise<ExtractionResult<T>>,
  ): Promise<ExtractionResult<T>> {
    // The primary (LLM + schema retry) never throws by contract, but a
    // rejected promise would otherwise bypass the failure branch below.
    let result: ExtractionResult<T>;
    try {
      result = await primary(request);
    } catch (err) {
      result = failureResult(err instanceof Error ? err.message : String(err));
    }

    if (result.status === 'success') {
      return result;
    }

    const fallbackModelId = `regex-fallback:${result.modelId}`;
    console.warn(
      `[RegexFallbackExtractor] FALLBACK ACTIVATED for document ${request.documentId} (${request.documentKind}). ` +
        `Primary extractor failed: ${result.error ?? 'unknown'}. ` +
        `Serving regex extraction. model_id will be recorded as "${fallbackModelId}".`,
    );

    const fallbackResult = await regex(request);
    if (fallbackResult.status !== 'success') {
      return {
        ...result,
        error: `${result.error ?? 'unknown'} (regex fallback also failed: ${fallbackResult.error ?? 'unknown'})`,
      };
    }

    return {
      ...fallbackResult,
      modelId: fallbackModelId,
    };
  }
}
