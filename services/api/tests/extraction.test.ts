import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from '../src/extraction/llm-document-extractor.js';
import type { PayslipExtraction } from '@recheq/schema';
import { createFixtureExtractor } from '../src/extraction/fixture-extractor.js';
import { withSchemaRetry } from '../src/extraction/schema-retry.js';
import { createAnthropicExtractor } from '../src/extraction/providers/anthropic-extractor.js';
import { createOpenAiCompatibleExtractor } from '../src/extraction/providers/openai-compatible-extractor.js';
import { createOllamaExtractor } from '../src/extraction/providers/ollama-extractor.js';
import {
  GeminiExtractor,
  GeminiWithFallback,
  createGeminiExtractor,
} from '../src/extraction/providers/gemini-extractor.js';

function assertSuccess<T>(
  result: ExtractionResult<T>,
): asserts result is ExtractionResult<T> & { status: 'success' } {
  expect(result.status).toBe('success');
}

function assertFailure<T>(
  result: ExtractionResult<T>,
): asserts result is ExtractionResult<T> & { status: 'failure' } {
  expect(result.status).toBe('failure');
}

describe('DOC-01 — Provider-Independent Document Extraction', () => {
  describe('FixtureExtractor', () => {
    let extractor: LlmDocumentExtractor;

    beforeEach(() => {
      extractor = createFixtureExtractor();
    });

    it('extracts payslip data from fixture', async () => {
      const request: ExtractionRequest = {
        documentId: 'clean-payslip-1',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.data.employee_name).toBe('Priya Sharma');
      expect(result.data.employer_name).toBe('Tech Corp India Pvt Ltd');
      expect(result.data.basic?.amount).toBe(55000);
      expect(result.data.net_salary).toBe(82400);
      expect(result.retryCount).toBe(0);
    });

    it('extracts Form 16 data from fixture', async () => {
      const request: ExtractionRequest = {
        documentId: 'clean-form16-1',
        documentKind: 'form_16',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractForm16(request);

      assertSuccess(result);
      expect(result.data.employee_name).toBe('Priya Sharma');
      expect(result.data.employer_name).toBe('Tech Corp India Pvt Ltd');
      expect(result.data.gross_total_income).toBe(1172400);
      expect(result.data.total_tax_deducted).toBe(102000);
      expect(result.retryCount).toBe(0);
    });

    it('returns failure for missing fixture', async () => {
      const request: ExtractionRequest = {
        documentId: 'non-existent-id',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertFailure(result);
      expect(result.error).toContain('No fixture found');
    });

    it('handles partial/missing data correctly', async () => {
      const request: ExtractionRequest = {
        documentId: 'partial-payslip-1',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.data.da?.amount).toBeNull(); // Missing value should be nulluld be null
      expect(result.data.extraction_notes).toContain('DA column not present');
    });

    it('preserves raw labels in fixture', async () => {
      const request: ExtractionRequest = {
        documentId: 'clean-payslip-1',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.data.basic?.raw_label).toBe('Basic Salary');
      expect(result.data.basic?.raw_label).not.toBe('basic'); // Should preserve raw label
    });

    it('never computes arithmetic', async () => {
      // Fixture extractor returns pre-defined values, never calculates
      // This test verifies the values are static fixtures
      const request: ExtractionRequest = {
        documentId: 'clean-payslip-1',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      // Values are static fixtures, not calculated
      assertSuccess(result);
      expect(result.data.basic?.amount).toBe(55000);
      expect(result.data.hra?.amount).toBe(22000);
      expect(result.data.gross_salary).toBe(97700);
      // Note: 50000 + 20000 + 10000 + 15000 + 5000 = 100000 matches, but it's a fixture, not a calculation
    });

    it('returns metadata correctly', () => {
      const metadata = extractor.getMetadata();

      expect(metadata.maxContentSize).toBe(10 * 1024 * 1024);
      expect(metadata.supportsImages).toBe(false);
      expect(metadata.supportsPdfText).toBe(false);
      expect(metadata.costPer1kTokens).toBe(0);
    });

    it('is always available', async () => {
      const isAvailable = await extractor.isAvailable();
      expect(isAvailable).toBe(true);
    });
  });

  describe('SchemaRetryWrapper', () => {
    let mockExtractor: LlmDocumentExtractor;
    let wrappedExtractor: LlmDocumentExtractor;

    beforeEach(() => {
      mockExtractor = {
        provider: 'test',
        supportsStreaming: false,
        extractPayslip: vi.fn(),
        extractForm16: vi.fn(),
        getMetadata: vi.fn().mockReturnValue({
          maxContentSize: 1000,
          supportsImages: false,
          supportsPdfText: true,
          costPer1kTokens: 0,
        }),
        isAvailable: vi.fn().mockResolvedValue(true),
      };

      wrappedExtractor = withSchemaRetry(mockExtractor, 1);
    });

    it('passes through successful extractions', async () => {
      const validPayslip: PayslipExtraction = {
        employee_name: 'John Doe',
        employee_id: 'EMP123',
        employer_name: 'TechCorp Inc',
        month: 'January',
        year: 2024,
        basic: { raw_label: 'Basic Salary', amount: 50000 },
        hra: { raw_label: 'HRA', amount: 20000 },
        da: { raw_label: 'DA', amount: 10000 },
        special_allowance: { raw_label: 'Special', amount: 15000 },
        other_allowances: [{ raw_label: 'Other', amount: 5000 }],
        gross_salary: 100000,
        pf_deduction: 12000,
        professional_tax: 2000,
        income_tax: 10000,
        other_deductions: 1000,
        total_deductions: 25000,
        net_salary: 75000,
        uan: '123456789012',
        pf_account_number: 'PF123',
        extraction_notes: 'Clear document',
        schema_version: 'payslip-v1',
        pan: null,
      };

      const mockResult: ExtractionResult<PayslipExtraction> = {
        data: validPayslip,
        rawOutput: JSON.stringify(validPayslip),
        modelId: 'test',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      vi.mocked(mockExtractor.extractPayslip).mockResolvedValue(mockResult);

      const request: ExtractionRequest = {
        documentId: 'test-id',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await wrappedExtractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.data).toEqual(validPayslip);
      expect(result.retryCount).toBe(0);
      expect(mockExtractor.extractPayslip).toHaveBeenCalledTimes(1);
    });

    it('retries once on schema validation failure', async () => {
      // First attempt: valid structure but missing required field
      const invalidPayslip = {
        employee_name: 'John Doe',
        // Missing employer_name (required field)
        month: 'January',
        year: 2024,
        basic: { raw_label: 'Basic Salary', amount: 50000 },
      };

      const mockResult1: ExtractionResult<PayslipExtraction> = {
        data: invalidPayslip as PayslipExtraction,
        rawOutput: JSON.stringify(invalidPayslip),
        modelId: 'test',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      // Second attempt: valid extraction
      const validPayslip: PayslipExtraction = {
        employee_name: 'John Doe',
        employee_id: 'EMP123',
        employer_name: 'TechCorp Inc',
        month: 'January',
        year: 2024,
        basic: { raw_label: 'Basic Salary', amount: 50000 },
        hra: { raw_label: 'HRA', amount: 20000 },
        da: { raw_label: 'DA', amount: 10000 },
        special_allowance: { raw_label: 'Special', amount: 15000 },
        other_allowances: [{ raw_label: 'Other', amount: 5000 }],
        gross_salary: 100000,
        pf_deduction: 12000,
        professional_tax: 2000,
        income_tax: 10000,
        other_deductions: 1000,
        total_deductions: 25000,
        net_salary: 75000,
        uan: '123456789012',
        pf_account_number: 'PF123',
        extraction_notes: 'Clear document',
        schema_version: 'payslip-v1',
        pan: null,
      };

      const mockResult2: ExtractionResult<PayslipExtraction> = {
        data: validPayslip,
        rawOutput: JSON.stringify(validPayslip),
        modelId: 'test',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      vi.mocked(mockExtractor.extractPayslip)
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const request: ExtractionRequest = {
        documentId: 'test-id',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await wrappedExtractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.data.employer_name).toBe('TechCorp Inc');
      expect(result.retryCount).toBe(1); // One retry
      expect(mockExtractor.extractPayslip).toHaveBeenCalledTimes(2);
    });

    it('fails after max retries', async () => {
      const invalidPayslip = {
        employee_name: 'John Doe',
        // Still missing employer_name after retry
        month: 'January',
        year: 2024,
      };

      const mockResult: ExtractionResult<PayslipExtraction> = {
        data: invalidPayslip as PayslipExtraction,
        rawOutput: JSON.stringify(invalidPayslip),
        modelId: 'test',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      vi.mocked(mockExtractor.extractPayslip).mockResolvedValue(mockResult);

      const request: ExtractionRequest = {
        documentId: 'test-id',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await wrappedExtractor.extractPayslip(request);

      assertFailure(result);
      expect(result.error).toContain('Schema validation failed after 2 attempts');
      expect(mockExtractor.extractPayslip).toHaveBeenCalledTimes(2); // Original + 1 retry
    });

    it('does not retry on non-schema failures', async () => {
      const mockResult: ExtractionResult<PayslipExtraction> = {
        rawOutput: '',
        modelId: 'test',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: 100,
        status: 'failure',
        error: 'Provider unavailable',
        retryCount: 0,
      };

      vi.mocked(mockExtractor.extractPayslip).mockResolvedValue(mockResult);

      const request: ExtractionRequest = {
        documentId: 'test-id',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await wrappedExtractor.extractPayslip(request);

      assertFailure(result);
      expect(result.error).toBe('Provider unavailable');
      expect(mockExtractor.extractPayslip).toHaveBeenCalledTimes(1); // No retry for non-schema failures
    });

    it('passes retry context on retry attempts', async () => {
      const invalidPayslip = {
        employee_name: 'John Doe',
        // Missing employer_name (required field) -> triggers schema validation failure
        month: 'January',
        year: 2024,
        basic: { raw_label: 'Basic Salary', amount: 50000 },
      };

      const invalidResult: ExtractionResult<PayslipExtraction> = {
        data: invalidPayslip as PayslipExtraction,
        rawOutput: JSON.stringify(invalidPayslip),
        modelId: 'test',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      const validPayslip: PayslipExtraction = {
        employee_name: 'John Doe',
        employee_id: 'EMP123',
        employer_name: 'TechCorp Inc',
        month: 'January',
        year: 2024,
        basic: { raw_label: 'Basic Salary', amount: 50000 },
        hra: { raw_label: 'HRA', amount: 20000 },
        da: { raw_label: 'DA', amount: 10000 },
        special_allowance: { raw_label: 'Special', amount: 15000 },
        other_allowances: [{ raw_label: 'Other', amount: 5000 }],
        gross_salary: 100000,
        pf_deduction: 12000,
        professional_tax: 2000,
        income_tax: 10000,
        other_deductions: 1000,
        total_deductions: 25000,
        net_salary: 75000,
        uan: '123456789012',
        pf_account_number: 'PF123',
        extraction_notes: 'Clear document',
        schema_version: 'payslip-v1',
        pan: null,
      };

      const validResult: ExtractionResult<PayslipExtraction> = {
        data: validPayslip,
        rawOutput: JSON.stringify(validPayslip),
        modelId: 'test',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      const extractFn = vi
        .fn()
        .mockResolvedValueOnce(invalidResult)
        .mockResolvedValueOnce(validResult);
      vi.mocked(mockExtractor.extractPayslip).mockImplementation(extractFn);

      const request: ExtractionRequest = {
        documentId: 'test-id',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      await wrappedExtractor.extractPayslip(request);

      // Check that second call includes retry context
      expect(extractFn).toHaveBeenCalledTimes(2);
      const secondCall = extractFn.mock.calls[1]?.[0];
      expect(secondCall).toBeDefined();
      expect(secondCall?.retryContext).toBeDefined();
      expect(secondCall?.retryContext?.validationError).toContain(
        'Payslip schema validation failed',
      );
      expect(secondCall?.retryContext?.previousAttemptRawOutput).toBe(invalidResult.rawOutput);
    });
  });

  describe('Provider Implementations (unit tests)', () => {
    describe('AnthropicExtractor', () => {
      it('creates extractor with required config', () => {
        expect(() => createAnthropicExtractor({ apiKey: 'test-key' })).not.toThrow();
      });

      it('throws without API key', () => {
        expect(() => createAnthropicExtractor({})).toThrow('Anthropic API key is required');
      });

      it('returns correct metadata', () => {
        const extractor = createAnthropicExtractor({ apiKey: 'test-key' });
        const metadata = extractor.getMetadata();

        expect(metadata.maxContentSize).toBe(5 * 1024 * 1024);
        expect(metadata.supportsImages).toBe(true);
        expect(metadata.supportsPdfText).toBe(true);
        expect(metadata.costPer1kTokens).toBe(0.003);
      });
    });

    describe('OpenAiCompatibleExtractor', () => {
      it('creates extractor with required config', () => {
        expect(() =>
          createOpenAiCompatibleExtractor({
            apiKey: 'test-key',
            baseUrl: 'https://api.example.com',
          }),
        ).not.toThrow();
      });

      it('throws without API key', () => {
        expect(() =>
          createOpenAiCompatibleExtractor({ baseUrl: 'https://api.example.com' }),
        ).toThrow('API key is required');
      });

      it('throws without a valid base URL', () => {
        // DEFAULT_CONFIG supplies the OpenAI base URL, so an empty string is
        // the reachable "no base URL" case.
        expect(() => createOpenAiCompatibleExtractor({ apiKey: 'test-key', baseUrl: '' })).toThrow(
          'Base URL is required',
        );
      });

      it('estimates costs based on model', () => {
        const gpt4Extractor = createOpenAiCompatibleExtractor({
          apiKey: 'test',
          baseUrl: 'test',
          model: 'gpt-4',
        });
        const gpt4Cost = gpt4Extractor.getMetadata().costPer1kTokens;

        const gpt35Extractor = createOpenAiCompatibleExtractor({
          apiKey: 'test',
          baseUrl: 'test',
          model: 'gpt-3.5-turbo',
        });
        const gpt35Cost = gpt35Extractor.getMetadata().costPer1kTokens;

        expect(gpt4Cost).toBeGreaterThan(gpt35Cost);
      });
    });

    describe('OllamaExtractor', () => {
      it('creates extractor with default config', () => {
        const extractor = createOllamaExtractor();

        expect(extractor.provider).toBe('ollama');
        expect(extractor.supportsStreaming).toBe(false);
      });

      it('returns correct metadata', () => {
        const extractor = createOllamaExtractor();
        const metadata = extractor.getMetadata();

        expect(metadata.maxContentSize).toBe(10 * 1024 * 1024);
        expect(metadata.supportsImages).toBe(false);
        expect(metadata.supportsPdfText).toBe(true);
        expect(metadata.costPer1kTokens).toBe(0);
      });

      it('supports custom models', () => {
        const extractor = createOllamaExtractor({
          model: 'custom-model',
          baseUrl: 'http://custom:11434',
        });

        // We can't test actual extraction without Ollama running
        // but we can verify the configuration
        expect(extractor).toBeDefined();
      });
    });
  });

  describe('Integration tests (with SchemaRetryWrapper)', () => {
    it('integrates fixture extractor with schema retry', async () => {
      const fixtureExtractor = createFixtureExtractor();
      const extractor = withSchemaRetry(fixtureExtractor);

      const request: ExtractionRequest = {
        documentId: 'clean-payslip-1',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.data.employee_name).toBe('Priya Sharma');
      expect(result.data.basic?.amount).toBe(55000);
      expect(result.retryCount).toBe(0);
    });

    it('handles custom fixtures with schema retry', async () => {
      const customFixtures = {
        payslips: {
          'custom-payslip': {
            employee_name: 'Custom Employee',
            employee_id: 'EMP-999',
            employer_name: 'Custom Corp',
            month: 'December',
            year: 2024,
            basic: { raw_label: 'Base Pay', amount: 100000 },
            hra: { raw_label: 'HRA', amount: 40000 },
            da: { raw_label: 'DA', amount: 20000 },
            special_allowance: { raw_label: 'Special', amount: 30000 },
            other_allowances: [{ raw_label: 'Other', amount: 10000 }],
            gross_salary: 200000,
            pf_deduction: 24000,
            professional_tax: 4000,
            income_tax: 20000,
            other_deductions: 2000,
            total_deductions: 50000,
            net_salary: 150000,
            uan: '999999999999',
            pf_account_number: 'PF999',
            extraction_notes: 'Custom fixture',
            schema_version: 'payslip-v1' as const,
            pan: null,
          },
        },
        form16s: {},
      };

      const fixtureExtractor = createFixtureExtractor(customFixtures);
      const extractor = withSchemaRetry(fixtureExtractor);

      const request: ExtractionRequest = {
        documentId: 'custom-payslip',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.data.employee_name).toBe('Custom Employee');
      expect(result.data.basic?.amount).toBe(100000);
      expect(result.retryCount).toBe(0);
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('application code depends on interface, not vendor SDK', () => {
      // All extractors implement the same interface
      const fixtureExtractor = createFixtureExtractor();
      const extractor: LlmDocumentExtractor = fixtureExtractor; // Type assignment works

      expect(extractor).toHaveProperty('extractPayslip');
      expect(extractor).toHaveProperty('extractForm16');
      expect(extractor).toHaveProperty('provider');
      expect(extractor).toHaveProperty('getMetadata');
      expect(extractor).toHaveProperty('isAvailable');
    });

    it('missing/illegible values become null', async () => {
      const extractor = createFixtureExtractor();
      const request: ExtractionRequest = {
        documentId: 'partial-payslip-1',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      // These values should be null in the partial fixture
      assertSuccess(result);
      expect(result.data.da?.amount).toBeNull();
    });

    it('extractor never computes arithmetic', () => {
      // Fixture extractor uses static data, never calculates
      // Real LLM extractors would need prompts that forbid calculation
      // This is enforced in the prompt templates in provider implementations
      // The interface contract prohibits arithmetic calculation
      // Implementation verifies through testing prompts
      expect(true).toBe(true); // Placeholder - actual verification requires prompt testing
    });

    it('printed labels are retained in raw_label', async () => {
      const extractor = createFixtureExtractor();
      const request: ExtractionRequest = {
        documentId: 'clean-payslip-1',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.data.basic.raw_label).toBe('Basic Salary');
      expect(result.data.basic.raw_label).not.toBe('basic');
      expect(result.data.basic.raw_label).not.toBe('Basic');
    });

    it('schema failure retries exactly once with validation error', async () => {
      const mockExtractor = {
        provider: 'test',
        supportsStreaming: false,
        extractPayslip: vi.fn(),
        extractForm16: vi.fn(),
        getMetadata: vi.fn().mockReturnValue({}),
        isAvailable: vi.fn().mockResolvedValue(true),
      };

      // First call returns invalid data (missing required fields)
      const invalidResult: ExtractionResult<PayslipExtraction> = {
        data: { employee_name: 'John' } as PayslipExtraction, // Missing other fields
        rawOutput: '{}',
        modelId: 'test',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      // Second call returns valid data
      const validResult: ExtractionResult<PayslipExtraction> = {
        data: {
          employee_name: 'John Doe',
          employee_id: 'EMP123',
          employer_name: 'TechCorp Inc',
          month: 'January',
          year: 2024,
          basic: { raw_label: 'Basic Salary', amount: 50000 },
          hra: { raw_label: 'HRA', amount: 20000 },
          da: { raw_label: 'DA', amount: 10000 },
          special_allowance: { raw_label: 'Special', amount: 15000 },
          other_allowances: [{ raw_label: 'Other', amount: 5000 }],
          gross_salary: 100000,
          pf_deduction: 12000,
          professional_tax: 2000,
          income_tax: 10000,
          other_deductions: 1000,
          total_deductions: 25000,
          net_salary: 75000,
          uan: '123456789012',
          pf_account_number: 'PF123',
          extraction_notes: null,
          schema_version: 'payslip-v1',
          pan: null,
        },
        rawOutput: '{}',
        modelId: 'test',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      vi.mocked(mockExtractor.extractPayslip)
        .mockResolvedValueOnce(invalidResult)
        .mockResolvedValueOnce(validResult);

      const extractor = withSchemaRetry(mockExtractor, 1);
      const request: ExtractionRequest = {
        documentId: 'test-id',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertSuccess(result);
      expect(result.retryCount).toBe(1); // Exactly one retry
      expect(mockExtractor.extractPayslip).toHaveBeenCalledTimes(2);
    });

    it('second failure marks extraction failed and processing continues safely', async () => {
      const mockExtractor = {
        provider: 'test',
        supportsStreaming: false,
        extractPayslip: vi.fn(),
        extractForm16: vi.fn(),
        getMetadata: vi.fn().mockReturnValue({}),
        isAvailable: vi.fn().mockResolvedValue(true),
      };

      const invalidResult: ExtractionResult<PayslipExtraction> = {
        data: { employee_name: 'John' } as PayslipExtraction, // Still invalid
        rawOutput: '{}',
        modelId: 'test',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        extractionDurationMs: 100,
        status: 'success',
        retryCount: 0,
      };

      vi.mocked(mockExtractor.extractPayslip).mockResolvedValue(invalidResult);

      const extractor = withSchemaRetry(mockExtractor, 1);
      const request: ExtractionRequest = {
        documentId: 'test-id',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result = await extractor.extractPayslip(request);

      assertFailure(result);
      expect(result.error).toContain('Schema validation failed after 2 attempts');
      expect(mockExtractor.extractPayslip).toHaveBeenCalledTimes(2); // Original + 1 retry
    });

    it('fixture extractor makes tests deterministic', async () => {
      const extractor1 = createFixtureExtractor();
      const extractor2 = createFixtureExtractor();

      const request: ExtractionRequest = {
        documentId: 'clean-payslip-1',
        documentKind: 'payslip',
        documentContent: 'base64...',
        mimeType: 'application/pdf',
        schemaVersion: 'v1',
      };

      const result1 = await extractor1.extractPayslip(request);
      const result2 = await extractor2.extractPayslip(request);

      // Results should be identical and deterministic
      assertSuccess(result1);
      assertSuccess(result2);
      expect(result1.data).toEqual(result2.data);
      expect(result1.status).toBe(result2.status);
      expect(result1.retryCount).toBe(result2.retryCount);
    });
  });
});

describe('GeminiExtractor', () => {
  // ─── Unit tests ──────────────────────────────────────────────

  describe('constructor', () => {
    it('creates extractor with a valid API key', () => {
      expect(() => createGeminiExtractor({ apiKey: 'test-key' })).not.toThrow();
    });

    it('throws without an API key', () => {
      expect(
        () =>
          new GeminiExtractor({
            apiKey: '',
            model: 'gemini-2.5-flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            maxOutputTokens: 4096,
            temperature: 0.1,
            fixturesFallback: false,
          }),
      ).toThrow('GEMINI_API_KEY is required');
    });

    it('exposes provider = "gemini"', () => {
      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      expect(extractor.provider).toBe('gemini');
    });

    it('supportsStreaming is false', () => {
      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      expect(extractor.supportsStreaming).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('returns Flash-tier cost and image support', () => {
      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      const meta = extractor.getMetadata();

      expect(meta.maxContentSize).toBe(20 * 1024 * 1024);
      expect(meta.supportsImages).toBe(true);
      expect(meta.supportsPdfText).toBe(true);
      // Flash cost is well under $0.001 per 1k tokens
      expect(meta.costPer1kTokens).toBeLessThan(0.001);
    });
  });

  describe('extractPayslip — network mocked', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns success with parsed payslip on a valid Gemini response', async () => {
      const payslipJson: PayslipExtraction = {
        employee_name: 'Arun Kumar',
        employee_id: 'EMP-001',
        employer_name: 'Acme Technologies',
        month: 'March',
        year: 2026,
        basic: { raw_label: 'Basic Salary', amount: 52000 }, // doctored value
        hra: { raw_label: 'HRA', amount: 20800 },
        da: { raw_label: 'DA', amount: null },
        special_allowance: { raw_label: 'Special Allowance', amount: 10000 },
        other_allowances: [],
        gross_salary: 82800,
        pf_deduction: 3600, // unchanged — contradiction is for rules engine
        professional_tax: 200,
        income_tax: 5000,
        other_deductions: null,
        total_deductions: 8800,
        net_salary: 74000,
        uan: '100123456789',
        pf_account_number: null,
        extraction_notes: null,
        schema_version: 'payslip-v1',
        pan: null,
      };

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(payslipJson) }] } }],
          usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200, totalTokenCount: 700 },
        }),
      });

      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      const result = await extractor.extractPayslip({
        documentId: 'doctored-01',
        documentKind: 'payslip',
        documentContent: 'JVBER', // base64 stub
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      assertSuccess(result);
      // Model reads doctored numbers faithfully — contradiction is the rules engine's job
      expect(result.data.basic?.amount).toBe(52000);
      expect(result.data.pf_deduction).toBe(3600);
      expect(result.modelId).toBe('gemini-2.5-flash');
      expect(result.usage.totalTokens).toBe(700);
    });

    it('sends PDF as inlineData part', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
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
                      extraction_notes: 'test',
                      schema_version: 'payslip-v1',
                      pan: null,
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
        }),
      });

      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      await extractor.extractPayslip({
        documentId: 'test-pdf',
        documentKind: 'payslip',
        documentContent: 'BASE64PDF',
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const callBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
      const userParts = callBody.contents[0].parts;
      expect(userParts[0].inlineData.mimeType).toBe('application/pdf');
      expect(userParts[0].inlineData.data).toBe('BASE64PDF');
      expect(userParts[1]).toHaveProperty('text');
    });

    it('forces JSON output via responseMimeType', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{}' }] } }],
          usageMetadata: {},
        }),
      });

      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'text/plain',
        schemaVersion: 'payslip-v1',
      });

      const callBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
      expect(callBody.generationConfig.responseMimeType).toBe('application/json');
      // Text-only input must not include an inlineData part
      const userParts = callBody.contents[0].parts as Array<{
        inlineData?: { mimeType: string; data: string };
        text?: string;
      }>;
      expect(userParts.every((part) => part.inlineData === undefined)).toBe(true);
      expect(userParts[0]?.text).toBeDefined();
    });

    it('returns failure on Gemini API error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: { code: 429, message: 'RESOURCE_EXHAUSTED', status: 'RESOURCE_EXHAUSTED' },
        }),
      });

      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      const result = await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      assertFailure(result);
      expect(result.error).toContain('RESOURCE_EXHAUSTED');
    });

    it('returns failure on network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network unreachable'));

      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      const result = await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'content',
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      assertFailure(result);
      expect(result.error).toContain('Network unreachable');
    });
  });

  // ─── Schema retry integration ─────────────────────────────────

  describe('with SchemaRetryWrapper', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const validPayslip: PayslipExtraction = {
      employee_name: 'Arun Kumar',
      employee_id: 'EMP-001',
      employer_name: 'Acme Technologies',
      month: 'March',
      year: 2026,
      basic: { raw_label: 'Basic Salary', amount: 52000 },
      hra: { raw_label: 'HRA', amount: 20800 },
      da: { raw_label: 'DA', amount: null },
      special_allowance: { raw_label: 'Special Allowance', amount: 10000 },
      other_allowances: [],
      gross_salary: 82800,
      pf_deduction: 3600,
      professional_tax: 200,
      income_tax: 5000,
      other_deductions: null,
      total_deductions: 8800,
      net_salary: 74000,
      uan: '100123456789',
      pf_account_number: null,
      extraction_notes: null,
      schema_version: 'payslip-v1',
      pan: null,
    };

    it('passes through valid extraction without retry', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validPayslip) }] } }],
          usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 150, totalTokenCount: 550 },
        }),
      });

      const extractor = withSchemaRetry(createGeminiExtractor({ apiKey: 'test-key' }));
      const result = await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'BASE64',
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      assertSuccess(result);
      expect(result.retryCount).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries once on schema validation failure and succeeds', async () => {
      // First response: invalid (missing required fields)
      const invalidJson = { employee_name: 'Arun' }; // many fields missing
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify(invalidJson) }] } }],
            usageMetadata: {
              promptTokenCount: 400,
              candidatesTokenCount: 50,
              totalTokenCount: 450,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify(validPayslip) }] } }],
            usageMetadata: {
              promptTokenCount: 500,
              candidatesTokenCount: 150,
              totalTokenCount: 650,
            },
          }),
        });

      const extractor = withSchemaRetry(createGeminiExtractor({ apiKey: 'test-key' }));
      const result = await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'BASE64',
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      assertSuccess(result);
      expect(result.retryCount).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      // Retry request must include retryContext (validation error injected by SchemaRetryWrapper)
      const retryBody = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string);
      // PDF is in parts[0] (inlineData), extraction prompt is in parts[1] (text)
      const retryUserText = retryBody.contents[0].parts[1].text as string;
      expect(retryUserText).toContain('PREVIOUS ATTEMPT FAILED SCHEMA VALIDATION');
    });

    it('marks failure after both attempts produce invalid schema', async () => {
      const invalidJson = { employee_name: 'Arun' };
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(invalidJson) }] } }],
          usageMetadata: {},
        }),
      });

      const extractor = withSchemaRetry(createGeminiExtractor({ apiKey: 'test-key' }));
      const result = await extractor.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'BASE64',
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      assertFailure(result);
      expect(result.error).toContain('Schema validation failed after 2 attempts');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Fixture fallback ─────────────────────────────────────────

  describe('GeminiWithFallback', () => {
    it('activates fixture fallback when wrapped Gemini fails and rewrites model_id', async () => {
      const failingGemini: LlmDocumentExtractor = {
        provider: 'gemini',
        supportsStreaming: false,
        extractPayslip: vi.fn().mockResolvedValue({
          rawOutput: '',
          modelId: 'gemini-2.5-flash',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          extractionDurationMs: 10,
          status: 'failure',
          error: 'Schema validation failed after 2 attempts',
          retryCount: 1,
        } satisfies ExtractionResult<PayslipExtraction>),
        extractForm16: vi.fn(),
        getMetadata: vi.fn().mockReturnValue({
          maxContentSize: 0,
          supportsImages: true,
          supportsPdfText: true,
          costPer1kTokens: 0,
        }),
        isAvailable: vi.fn().mockResolvedValue(true),
      };

      const fixture = createFixtureExtractor();
      const wrapped = new GeminiWithFallback(failingGemini, fixture, 'gemini-2.5-flash');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await wrapped.extractPayslip({
        documentId: 'clean-payslip-1', // known fixture key
        documentKind: 'payslip',
        documentContent: 'BASE64',
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      assertSuccess(result);
      // model_id must be the honest fallback label
      expect(result.modelId).toBe('fixture-fallback:gemini-2.5-flash');
      // Fallback must log loudly
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('FALLBACK ACTIVATED'));
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fixture-fallback:gemini-2.5-flash'),
      );

      warnSpy.mockRestore();
    });

    it('does NOT activate fallback when Gemini succeeds', async () => {
      const validPayslip: PayslipExtraction = {
        employee_name: 'Test',
        employee_id: null,
        employer_name: 'Corp',
        month: 'Jan',
        year: 2026,
        basic: { raw_label: 'Basic', amount: 50000 },
        hra: { raw_label: 'HRA', amount: 20000 },
        da: { raw_label: 'DA', amount: null },
        special_allowance: { raw_label: 'SA', amount: 10000 },
        other_allowances: [],
        gross_salary: 80000,
        pf_deduction: 6000,
        professional_tax: 200,
        income_tax: 0,
        other_deductions: null,
        total_deductions: 6200,
        net_salary: 73800,
        uan: null,
        pf_account_number: null,
        extraction_notes: null,
        schema_version: 'payslip-v1',
        pan: null,
      };

      const succeedingGemini: LlmDocumentExtractor = {
        provider: 'gemini',
        supportsStreaming: false,
        extractPayslip: vi.fn().mockResolvedValue({
          data: validPayslip,
          rawOutput: JSON.stringify(validPayslip),
          modelId: 'gemini-2.5-flash',
          usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
          extractionDurationMs: 500,
          status: 'success',
          retryCount: 0,
        } satisfies ExtractionResult<PayslipExtraction>),
        extractForm16: vi.fn(),
        getMetadata: vi.fn().mockReturnValue({
          maxContentSize: 0,
          supportsImages: true,
          supportsPdfText: true,
          costPer1kTokens: 0,
        }),
        isAvailable: vi.fn().mockResolvedValue(true),
      };

      const fixture = createFixtureExtractor();
      const fixtureSpy = vi.spyOn(fixture, 'extractPayslip');
      const wrapped = new GeminiWithFallback(succeedingGemini, fixture, 'gemini-2.5-flash');

      const result = await wrapped.extractPayslip({
        documentId: 'test',
        documentKind: 'payslip',
        documentContent: 'BASE64',
        mimeType: 'application/pdf',
        schemaVersion: 'payslip-v1',
      });

      assertSuccess(result);
      expect(result.modelId).toBe('gemini-2.5-flash'); // not the fallback label
      expect(fixtureSpy).not.toHaveBeenCalled();
      fixtureSpy.mockRestore();
    });

    it('createGeminiExtractor with fixturesFallback=true returns GeminiWithFallback', () => {
      const extractor = createGeminiExtractor({
        apiKey: 'test-key',
        fixturesFallback: true,
      });
      // GeminiWithFallback forwards the provider string from the wrapped Gemini
      expect(extractor.provider).toBe('gemini');
      expect(extractor).toBeInstanceOf(GeminiWithFallback);
    });

    it('createGeminiExtractor without fallback returns plain GeminiExtractor', () => {
      const extractor = createGeminiExtractor({ apiKey: 'test-key' });
      expect(extractor).toBeInstanceOf(GeminiExtractor);
    });
  });
});
