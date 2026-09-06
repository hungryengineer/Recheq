import { describe, it, expect, vi, afterEach } from 'vitest';
import { PayslipExtraction, Form16Extraction } from '@recheq/schema';
import { buildPayslipPrompt } from '../src/extraction/prompts/payslip-v1.js';
import { buildForm16Prompt } from '../src/extraction/prompts/form16-v1.js';
import { createOpenAiCompatibleExtractor } from '../src/extraction/providers/openai-compatible-extractor.js';
import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../src/extraction/llm-document-extractor.js';
import type { PayslipExtraction as PayslipPayload } from '@recheq/schema';
import { RegexFallbackExtractor } from '../src/extraction/providers/regex-fallback-extractor.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── 1. Prompt <-> schema contract ──────────────────────────────
// Regression guard for the payslip "pan" bug: every key REQUIRED by the
// (frozen) extraction schema must appear in the prompt's JSON shape, otherwise
// the model's output can never validate and every doc silently falls back.
function promptCoversSchemaShape(
  promptUser: string,
  schemaShape: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const key of Object.keys(schemaShape)) {
    if (!promptUser.includes(`"${key}"`)) {
      missing.push(key);
    }
  }
  return missing;
}

describe('Prompt <-> Schema contract', () => {
  it('payslip prompt JSON shape covers every schema-required key', () => {
    const { user } = buildPayslipPrompt('DOCUMENT_FIXTURE');
    const missing = promptCoversSchemaShape(user, PayslipExtraction.shape);
    expect(missing).toEqual([]);
  });

  it('payslip prompt includes the schema-required "pan" key', () => {
    const { user } = buildPayslipPrompt('DOCUMENT_FIXTURE');
    expect(user).toContain('"pan": string | null');
  });

  it('form16 prompt JSON shape covers every schema-required key', () => {
    const { user } = buildForm16Prompt('DOCUMENT_FIXTURE');
    const missing = promptCoversSchemaShape(user, Form16Extraction.shape);
    expect(missing).toEqual([]);
  });

  it('form16 prompt keeps the PAN/TAN fields alongside their owners', () => {
    const { system, user } = buildForm16Prompt('DOCUMENT_FIXTURE');
    expect(system).toContain('employee_pan');
    expect(system).toContain('employer_pan');
    expect(user).toContain('"employee_pan"');
    expect(user).toContain('"employer_pan"');
    expect(user).toContain('"employer_tan"');
  });
});

// ─── 2. OpenAI-compatible provider: 429 rate-limit retry ────────
function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function successBody(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    choices: [{ message: { content: JSON.stringify({ employee_name: 'Priya Sharma' }) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    ...overrides,
  };
}

const smallConfig = { rateLimitBaseBackoffMs: 1, timeoutMs: 1000 };
describe('OpenAiCompatibleExtractor — 429 retry', () => {
  it('retries on 429 and succeeds once the provider allows the request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { code: 'rate_limit_exceeded' } }))
      .mockResolvedValue(jsonResponse(200, successBody()));
    vi.stubGlobal('fetch', fetchMock);

    const extractor = createOpenAiCompatibleExtractor({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1',
      ...smallConfig,
    });
    const result = await extractor.extractPayslip({
      documentId: 'doc-1',
      documentKind: 'payslip',
      documentContent: 'text',
      mimeType: 'text/plain',
      schemaVersion: 'payslip-v1',
    });

    expect(result.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honours the Retry-After header for backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '0' }))
      .mockResolvedValue(jsonResponse(200, successBody()));
    vi.stubGlobal('fetch', fetchMock);

    const extractor = createOpenAiCompatibleExtractor({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1',
      ...smallConfig,
    });
    const result = await extractor.extractPayslip({
      documentId: 'doc-1',
      documentKind: 'payslip',
      documentContent: 'text',
      mimeType: 'text/plain',
      schemaVersion: 'payslip-v1',
    });

    expect(result.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails after exhausting all 429 retries instead of masking as success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(429, { error: { message: 'tokens per minute' } }));
    vi.stubGlobal('fetch', fetchMock);

    const extractor = createOpenAiCompatibleExtractor({
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/v1',
      maxRateLimitRetries: 2,
      ...smallConfig,
    });
    const result = await extractor.extractPayslip({
      documentId: 'doc-1',
      documentKind: 'payslip',
      documentContent: 'text',
      mimeType: 'text/plain',
      schemaVersion: 'payslip-v1',
    });

    expect(result.status).toBe('failure');
    if (result.status === 'failure') {
      expect(result.error).toContain('429');
    }
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

// ─── 3. Regex fallback must not mask an EMPTY extraction ────────
function failureOf(error: string): ExtractionResult<PayslipPayload> {
  return {
    status: 'failure',
    error,
    rawOutput: '',
    modelId: 'primary',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    extractionDurationMs: 0,
    retryCount: 1,
  };
}

function emptySuccessPayslip(): ExtractionResult<PayslipPayload> {
  return {
    status: 'success',
    data: {
      employee_name: null,
      employee_id: null,
      employer_name: null,
      month: null,
      year: null,
      basic: { raw_label: null, amount: null },
      hra: { raw_label: null, amount: null },
      da: { raw_label: null, amount: null },
      special_allowance: { raw_label: null, amount: null },
      other_allowances: [],
      gross_salary: null,
      pf_deduction: null,
      professional_tax: null,
      income_tax: null,
      other_deductions: null,
      total_deductions: null,
      net_salary: null,
      uan: null,
      pf_account_number: null,
      pan: null,
      extraction_notes: 'regex fast-path',
      schema_version: 'payslip-v1' as const,
    },
    rawOutput: '',
    modelId: 'regex',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    extractionDurationMs: 0,
    retryCount: 0,
  };
}

function makePrimary(fail: () => ExtractionResult<PayslipPayload>): LlmDocumentExtractor {
  return {
    provider: 'primary',
    supportsStreaming: false,
    getMetadata: () => ({
      maxContentSize: 1000000,
      supportsImages: false,
      supportsPdfText: true,
      costPer1kTokens: 0,
    }),
    isAvailable: async () => true,
    extractPayslip: async () => fail(),
    extractForm16: async () => failureOf('primary form16 failed') as ExtractionResult<never>,
  };
}

function makeEmptyRegex(): LlmDocumentExtractor {
  const base = makePrimary(() => emptySuccessPayslip());
  return {
    ...base,
    extractPayslip: async () => emptySuccessPayslip(),
  };
}

describe('RegexFallbackExtractor — empty fallback', () => {
  it('surfaces a failure when the LLM path failed and the regex fallback extracted nothing', async () => {
    const primary = makePrimary(() => failureOf('schema validation failed: pan required'));
    const regex = makeEmptyRegex();
    const extractor = new RegexFallbackExtractor(primary, regex);

    const result = await extractor.extractPayslip({
      documentId: 'doc-empty',
      documentKind: 'payslip',
      documentContent: 'some text',
      mimeType: 'text/plain',
      schemaVersion: 'payslip-v1',
    });

    expect(result.status).toBe('failure');
    if (result.status === 'failure') {
      expect(result.error).toContain('returned no extractable fields');
    }
  });
});
