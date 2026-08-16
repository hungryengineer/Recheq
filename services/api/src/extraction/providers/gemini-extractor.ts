// ─── Gemini Provider Implementation ────────────────────────────
// Implements LlmDocumentExtractor using the Google Gemini REST API.
//
// Design decisions:
// - Uses Flash-tier models (gemini-2.5-flash default) — ~5x cheaper than Pro,
//   fast enough for live demo, and today we will run hundreds of test extractions.
// - Sends PDFs as inline base64 parts so the model reads printed figures
//   directly from the rendered document, not from text extraction. This is
//   important because the demo hinges on the model faithfully reading doctored
//   numbers (basic=52000, pf=3600) without noticing the contradiction — that
//   split is the pitch.
// - Forces JSON output via responseMimeType: 'application/json'.
// - Wraps with SchemaRetryWrapper: one retry with the Zod error appended, then
//   ExtractionFailed. When EXTRACTION_FALLBACK=fixture and both attempts fail,
//   falls back to the fixture extractor. The fallback path is logged loudly and
//   the model_id is recorded as "fixture-fallback:<gemini-model>" so we never
//   lie on stage about which path served the extraction.

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';
import { buildPayslipPrompt } from '../prompts/payslip-v1.js';
import { buildForm16Prompt } from '../prompts/form16-v1.js';
import { createFixtureExtractor } from '../fixture-extractor.js';

// ─── Configuration ───────────────────────────────────────────────

export interface GeminiExtractorConfig {
  /** Google Gemini API key */
  apiKey: string;
  /**
   * Model name. Default: gemini-2.5-flash.
   * Use Flash-tier models for cost and speed. Pro is ~5x more expensive.
   */
  model: string;
  /** Base URL for the Gemini REST API */
  baseUrl: string;
  /** Max tokens to generate */
  maxOutputTokens: number;
  /** Temperature — keep low for deterministic extraction */
  temperature: number;
  /**
   * When true, fall back to the fixture extractor if Gemini fails both
   * attempts. Controlled by EXTRACTION_FALLBACK=fixture env var.
   * The fallback path is loudly logged and recorded in model_id.
   */
  fixturesFallback: boolean;
}

const DEFAULT_CONFIG: GeminiExtractorConfig = {
  apiKey: '',
  model: 'gemini-2.5-flash',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  maxOutputTokens: 4096,
  temperature: 0.1,
  fixturesFallback: false,
};

// ─── Gemini REST API types ────────────────────────────────────────

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiRequest {
  system_instruction: { parts: GeminiPart[] };
  contents: GeminiContent[];
  generationConfig: {
    responseMimeType: 'application/json';
    maxOutputTokens: number;
    temperature: number;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// ─── Extractor ───────────────────────────────────────────────────

export class GeminiExtractor implements LlmDocumentExtractor {
  readonly provider = 'gemini';
  readonly supportsStreaming = false;

  private readonly fallbackExtractor: LlmDocumentExtractor | null;

  constructor(private readonly config: GeminiExtractorConfig = DEFAULT_CONFIG) {
    if (!config.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.fallbackExtractor = config.fixturesFallback ? createFixtureExtractor() : null;
  }

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    return this.extractDocument<PayslipExtraction>(request, 'payslip');
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    return this.extractDocument<Form16Extraction>(request, 'form16');
  }

  getMetadata() {
    return {
      // Gemini 1.5/2.0/2.5 Flash supports up to 1M token context; 20 MB is
      // a practical upload limit that keeps latency reasonable.
      maxContentSize: 20 * 1024 * 1024,
      supportsImages: true,
      supportsPdfText: true,
      costPer1kTokens: 0.000075, // gemini-2.5-flash input cost ($/1k tokens)
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // List available models as a lightweight health check.
      const response = await fetch(`${this.config.baseUrl}/models?key=${this.config.apiKey}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Private ─────────────────────────────────────────────────

  private async extractDocument<T>(
    request: ExtractionRequest,
    documentType: 'payslip' | 'form16',
  ): Promise<ExtractionResult<T>> {
    const startTime = Date.now();
    let rawOutput = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    try {
      const prompt =
        documentType === 'payslip'
          ? buildPayslipPrompt(request.documentContent, request.retryContext?.validationError)
          : buildForm16Prompt(request.documentContent, request.retryContext?.validationError);

      const body = this.buildRequestBody(request, prompt);

      const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      const data: GeminiResponse = await response.json();

      if (!response.ok || data.error) {
        const msg = data.error?.message ?? `HTTP ${response.status}`;
        throw new Error(`Gemini API error: ${msg}`);
      }

      rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      usage = {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      };

      const parsed = this.parseJsonResponse<T>(rawOutput, documentType);

      return {
        data: parsed,
        rawOutput,
        modelId: this.config.model,
        usage,
        extractionDurationMs: Date.now() - startTime,
        status: 'success',
        retryCount: request.retryContext ? 1 : 0,
      };
    } catch (error) {
      return {
        data: {} as T,
        rawOutput,
        modelId: this.config.model,
        usage,
        extractionDurationMs: Date.now() - startTime,
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
        retryCount: request.retryContext ? 1 : 0,
      };
    }
  }

  /**
   * Build the Gemini REST request body.
   *
   * PDFs and images are sent as inline base64 parts so the model reads the
   * rendered document directly — preserving the exact printed numbers, fonts,
   * and layout that matter for the forensics demo.
   *
   * Plain text falls back to a text part (for test fixtures and pre-extracted
   * content).
   */
  private buildRequestBody(
    request: ExtractionRequest,
    prompt: { system: string; user: string },
  ): GeminiRequest {
    const isPdf = request.mimeType === 'application/pdf';
    const isImage = request.mimeType.startsWith('image/');

    let userParts: GeminiPart[];

    if (isPdf || isImage) {
      // Send document as inline base64 + the extraction instruction as text.
      userParts = [
        {
          inlineData: {
            mimeType: request.mimeType,
            data: request.documentContent, // already base64 from caller
          },
        },
        { text: prompt.user },
      ];
    } else {
      // Plain text or pre-extracted content — text part only.
      userParts = [{ text: prompt.user }];
    }

    return {
      system_instruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: userParts }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: this.config.maxOutputTokens,
        temperature: this.config.temperature,
      },
    };
  }

  private parseJsonResponse<T>(rawOutput: string, documentType: string): T {
    let jsonStr = rawOutput.trim();

    // Strip markdown fences in case the model ignores responseMimeType.
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    try {
      const parsed: unknown = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Expected JSON object');
      }
      return parsed as T;
    } catch (err) {
      throw new Error(
        `Failed to parse ${documentType} JSON from Gemini: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// ─── Fallback-aware wrapper ───────────────────────────────────────
//
// Wraps a GeminiExtractor (already inside SchemaRetryWrapper) and intercepts
// final failures when EXTRACTION_FALLBACK=fixture is set. On fallback:
//   1. Logs loudly (console.warn) — visible in demo terminal.
//   2. Calls the fixture extractor for the same request.
//   3. Rewrites model_id to "fixture-fallback:<gemini-model>" so the DB record
//      is honest about which path served the result.

export class GeminiWithFallback implements LlmDocumentExtractor {
  readonly provider: string;
  readonly supportsStreaming: boolean;

  constructor(
    private readonly gemini: LlmDocumentExtractor,
    private readonly fixture: LlmDocumentExtractor,
    private readonly geminiModel: string,
  ) {
    this.provider = gemini.provider;
    this.supportsStreaming = gemini.supportsStreaming;
  }

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    return this.withFallback(
      request,
      'payslip',
      () => this.gemini.extractPayslip(request),
      () => this.fixture.extractPayslip(request),
    );
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    return this.withFallback(
      request,
      'form16',
      () => this.gemini.extractForm16(request),
      () => this.fixture.extractForm16(request),
    );
  }

  getMetadata() {
    return this.gemini.getMetadata();
  }

  async isAvailable(): Promise<boolean> {
    return this.gemini.isAvailable();
  }

  private async withFallback<T>(
    request: ExtractionRequest,
    kind: string,
    primary: () => Promise<ExtractionResult<T>>,
    fallback: () => Promise<ExtractionResult<T>>,
  ): Promise<ExtractionResult<T>> {
    const result = await primary();

    if (result.status === 'success') {
      return result;
    }

    // Primary (Gemini + schema-retry) exhausted both attempts — activate fallback.
    const fallbackModelId = `fixture-fallback:${this.geminiModel}`;
    console.warn(
      `[GeminiExtractor] FALLBACK ACTIVATED for ${kind} document ${request.documentId}. ` +
        `Gemini failed: ${result.error ?? 'unknown'}. ` +
        `Serving fixture extraction. model_id will be recorded as "${fallbackModelId}".`,
    );

    const fallbackResult = await fallback();

    return {
      ...fallbackResult,
      // Overwrite model_id so the DB record reflects the actual serving path.
      modelId: fallbackModelId,
    };
  }
}

// ─── Factory ─────────────────────────────────────────────────────

/**
 * Create a GeminiExtractor from explicit config, optionally wrapping it in the
 * fixture fallback layer.
 */
export function createGeminiExtractor(
  config: Partial<GeminiExtractorConfig> = {},
): LlmDocumentExtractor {
  const fullConfig: GeminiExtractorConfig = { ...DEFAULT_CONFIG, ...config };
  const extractor = new GeminiExtractor(fullConfig);

  if (fullConfig.fixturesFallback) {
    return new GeminiWithFallback(extractor, createFixtureExtractor(), fullConfig.model);
  }

  return extractor;
}

/**
 * Create a GeminiExtractor by reading environment variables.
 *
 * Required:  GEMINI_API_KEY
 * Optional:  EXTRACTION_MODEL (default: gemini-2.5-flash)
 *            EXTRACTION_FALLBACK=fixture  → activates fixture fallback
 */
export function createGeminiExtractorFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LlmDocumentExtractor {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  return createGeminiExtractor({
    apiKey,
    model: env.EXTRACTION_MODEL ?? DEFAULT_CONFIG.model,
    fixturesFallback: env.EXTRACTION_FALLBACK === 'fixture',
  });
}
