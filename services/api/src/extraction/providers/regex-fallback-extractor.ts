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
    return this.withFallback(request, 'payslip', () => this.primary.extractPayslip(request));
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    return this.withFallback(request, 'form16', () => this.primary.extractForm16(request));
  }

  getMetadata() {
    return this.primary.getMetadata();
  }

  async isAvailable(): Promise<boolean> {
    return this.primary.isAvailable();
  }

  private async withFallback<T>(
    request: ExtractionRequest,
    kind: 'payslip' | 'form16',
    primary: () => Promise<ExtractionResult<T>>,
  ): Promise<ExtractionResult<T>> {
    const result = await primary();

    if (result.status === 'success') {
      return result;
    }

    const fallbackModelId = `regex-fallback:${result.modelId}`;
    console.warn(
      `[RegexFallbackExtractor] FALLBACK ACTIVATED for ${kind} document ${request.documentId}. ` +
        `Primary extractor failed: ${result.error ?? 'unknown'}. ` +
        `Serving regex extraction. model_id will be recorded as "${fallbackModelId}".`,
    );

    let fallbackResult: ExtractionResult<T>;
    if (kind === 'payslip') {
      fallbackResult = (await this.regex.extractPayslip(request)) as unknown as ExtractionResult<T>;
    } else {
      fallbackResult = (await this.regex.extractForm16(request)) as unknown as ExtractionResult<T>;
    }

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
