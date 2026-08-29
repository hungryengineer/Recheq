import { describe, it, expect, vi } from 'vitest';
import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../src/extraction/llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';
import { RegexFallbackExtractor } from '../src/extraction/providers/regex-fallback-extractor.js';
import { createProductionExtractor } from '../src/extraction/extractor-factory.js';

function makeRequest(kind: 'payslip' | 'form_16' = 'payslip'): ExtractionRequest {
  return {
    documentId: 'doc-1',
    documentKind: kind,
    documentContent: 'some document text',
    mimeType: 'text/plain',
    schemaVersion: kind === 'payslip' ? 'payslip-v1' : 'form16-v1',
  };
}

function makeSuccess<T>(data: T): ExtractionResult<T> {
  return {
    status: 'success',
    data,
    rawOutput: '{}',
    modelId: 'primary-model',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    extractionDurationMs: 10,
    retryCount: 0,
  };
}

function makeFailure<T>(error: string): ExtractionResult<T> {
  return {
    status: 'failure',
    error,
    rawOutput: '',
    modelId: 'primary-model',
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    extractionDurationMs: 10,
    retryCount: 1,
  };
}

describe('RegexFallbackExtractor', () => {
  it('passes through primary success results untouched', async () => {
    const payslip: PayslipExtraction = {
      employee_name: 'Priya Sharma',
      pan: 'ABCPS1234F',
      gross_salary: 50000,
      net_salary: 41400,
    } as unknown as PayslipExtraction;
    const primary: LlmDocumentExtractor = {
      provider: 'openai-compatible',
      supportsStreaming: true,
      extractPayslip: vi.fn(async () => makeSuccess(payslip)),
      extractForm16: vi.fn(async () => makeFailure<Form16Extraction>('unused')),
      getMetadata: () => ({
        maxContentSize: 1024,
        supportsImages: true,
        supportsPdfText: true,
        costPer1kTokens: 0.001,
      }),
      isAvailable: async () => true,
    };

    const extractor = new RegexFallbackExtractor(primary);
    const result = await extractor.extractPayslip(makeRequest());
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.data).toBe(payslip);
      expect(result.modelId).toBe('primary-model');
    }
  });

  it('falls back to regex extraction when the primary fails', async () => {
    const primary: LlmDocumentExtractor = {
      provider: 'openai-compatible',
      supportsStreaming: true,
      extractPayslip: vi.fn(async () => makeFailure<PayslipExtraction>('API down')),
      extractForm16: vi.fn(async () => makeFailure<Form16Extraction>('API down')),
      getMetadata: () => ({
        maxContentSize: 1024,
        supportsImages: true,
        supportsPdfText: true,
        costPer1kTokens: 0.001,
      }),
      isAvailable: async () => true,
    };

    const extractor = new RegexFallbackExtractor(primary);
    const result = await extractor.extractPayslip(makeRequest());
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.modelId).toContain('regex-fallback:');
    }
  });

  it('preserves primary provider so the extraction step formats input correctly', () => {
    const primary: LlmDocumentExtractor = {
      provider: 'gemini',
      supportsStreaming: false,
      extractPayslip: vi.fn(),
      extractForm16: vi.fn(),
      getMetadata: () => ({
        maxContentSize: 1024,
        supportsImages: true,
        supportsPdfText: true,
        costPer1kTokens: 0.001,
      }),
      isAvailable: async () => true,
    };
    const extractor = new RegexFallbackExtractor(primary);
    expect(extractor.provider).toBe('gemini');
  });
});

describe('createProductionExtractor', () => {
  it('returns the regex extractor when no LLM keys are present', () => {
    const extractor = createProductionExtractor({} as NodeJS.ProcessEnv);
    expect(extractor.provider).toBe('regex-fast-parser');
  });

  it('selects the OpenAI-compatible extractor when OPENAI_API_KEY is set', () => {
    const extractor = createProductionExtractor({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
      OPENAI_MODEL: 'gpt-4o-mini',
    } as NodeJS.ProcessEnv);
    expect(extractor.provider).toBe('openai-compatible');
  });

  it('selects the Gemini extractor when GEMINI_API_KEY is set', () => {
    const extractor = createProductionExtractor({
      GEMINI_API_KEY: 'test-gemini-key',
    } as NodeJS.ProcessEnv);
    expect(extractor.provider).toBe('gemini');
  });
});
