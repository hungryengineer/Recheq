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
import type { PayslipExtraction, Form16Extraction } from '@recheq/schema';
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

    // The fallback must not present an EMPTY extraction as a clean success:
    // recording a doc as "extracted" with no real fields would silently feed a
    // bogus confidence score and hide that the LLM path failed. If the regex
    // path found no meaningful data, surface a failure so the pipeline marks
    // the document failed (and confidence is honestly 0 / a finding fires).
    if (isEmptyExtraction(fallbackResult.data)) {
      return {
        ...result,
        error: `${result.error ?? 'primary failed'} (regex fallback returned no extractable fields)`,
      };
    }

    return {
      ...fallbackResult,
      modelId: fallbackModelId,
    };
  }
}

/**
 * True when a fallback "success" actually contains no meaningful extracted
 * data, i.e. the extraction should be treated as a failure rather than a
 * clean-but-empty success.
 */
function isEmptyExtraction(data: unknown): boolean {
  if (data === null || typeof data !== 'object') return true;
  const rec = data as Record<string, unknown>;
  // Payslip: net + gross + employer are the minimum a real slip carries.
  const payslipEmpty =
    rec.net_salary == null && rec.gross_salary == null && rec.employer_name == null;
  // Form 16: employee identity + PAN + employer are the minimum a real form carries.
  const form16Empty =
    rec.employee_pan == null && rec.employee_name == null && rec.employer_name == null;
  return payslipEmpty && form16Empty;
}
