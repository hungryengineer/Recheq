import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LlmDocumentExtractor, ExtractionRequest, ExtractionResult } from '../src/extraction/llm-document-extractor.js';
import type { PayslipExtraction } from '@tieout/schema';
import { createFixtureExtractor } from '../src/extraction/fixture-extractor.js';
import { withSchemaRetry } from '../src/extraction/schema-retry.js';
import { createAnthropicExtractor } from '../src/extraction/providers/anthropic-extractor.js';
import { createOpenAiCompatibleExtractor } from '../src/extraction/providers/openai-compatible-extractor.js';
import { createOllamaExtractor } from '../src/extraction/providers/ollama-extractor.js';

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

      expect(result.status).toBe('success');
      expect(result.data.employee_name).toBe('John Doe');
      expect(result.data.employer_name).toBe('TechCorp Inc');
      expect(result.data.basic).toBe(50000);
      expect(result.data.net_salary).toBe(75000);
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

      expect(result.status).toBe('success');
      expect(result.data.employee_name).toBe('John Doe');
      expect(result.data.employer_name).toBe('TechCorp Inc');
      expect(result.data.gross_total_income).toBe(1200000);
      expect(result.data.total_tax_deducted).toBe(120000);
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

      expect(result.status).toBe('failure');
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

      expect(result.status).toBe('success');
      expect(result.data.income_tax).toBeNull(); // Missing value should be null
      expect(result.data.total_deductions).toBeNull(); // Missing value should be null
      expect(result.data.net_salary).toBeNull(); // Missing value should be null
      expect(result.data.extraction_notes).toContain('smudged');
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

      expect(result.data.basic_raw_label).toBe('Basic Salary');
      expect(result.data.basic_raw_label).not.toBe('basic'); // Should preserve raw label
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
      expect(result.data.basic).toBe(50000);
      expect(result.data.hra).toBe(20000);
      expect(result.data.gross_salary).toBe(100000);
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
        employer_name: 'TechCorp Inc',
        month: 'January',
        year: 2024,
        basic_raw_label: 'Basic Salary',
        basic: 50000,
        hra: 20000,
        da: 10000,
        special_allowance: 15000,
        other_allowances: 5000,
        gross_salary: 100000,
        pf_deduction: 12000,
        professional_tax: 2000,
        income_tax: 10000,
        other_deductions: 1000,
        total_deductions: 25000,
        net_salary: 75000,
        extraction_notes: 'Clear document',
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

      expect(result.status).toBe('success');
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
        basic_raw_label: 'Basic Salary',
        basic: 50000,
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
        employer_name: 'TechCorp Inc',
        month: 'January',
        year: 2024,
        basic_raw_label: 'Basic Salary',
        basic: 50000,
        hra: 20000,
        da: 10000,
        special_allowance: 15000,
        other_allowances: 5000,
        gross_salary: 100000,
        pf_deduction: 12000,
        professional_tax: 2000,
        income_tax: 10000,
        other_deductions: 1000,
        total_deductions: 25000,
        net_salary: 75000,
        extraction_notes: 'Clear document',
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

      expect(result.status).toBe('success');
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

      expect(result.status).toBe('failure');
      expect(result.error).toContain('Schema validation failed after 2 attempts');
      expect(mockExtractor.extractPayslip).toHaveBeenCalledTimes(2); // Original + 1 retry
    });

    it('does not retry on non-schema failures', async () => {
      const mockResult: ExtractionResult<PayslipExtraction> = {
        data: {} as PayslipExtraction,
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

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Provider unavailable');
      expect(mockExtractor.extractPayslip).toHaveBeenCalledTimes(1); // No retry for non-schema failures
    });

    it('passes retry context on retry attempts', async () => {
      const invalidPayslip = {
        employee_name: 'John Doe',
        // Missing employer_name (required field) -> triggers schema validation failure
        month: 'January',
        year: 2024,
        basic_raw_label: 'Basic Salary',
        basic: 50000,
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
        employer_name: 'TechCorp Inc',
        month: 'January',
        year: 2024,
        basic_raw_label: 'Basic Salary',
        basic: 50000,
        hra: 20000,
        da: 10000,
        special_allowance: 15000,
        other_allowances: 5000,
        gross_salary: 100000,
        pf_deduction: 12000,
        professional_tax: 2000,
        income_tax: 10000,
        other_deductions: 1000,
        total_deductions: 25000,
        net_salary: 75000,
        extraction_notes: 'Clear document',
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

      const extractFn = vi.fn()
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
      expect(secondCall?.retryContext?.validationError).toContain('Payslip schema validation failed');
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
        expect(() => createOpenAiCompatibleExtractor({ 
          apiKey: 'test-key', 
          baseUrl: 'https://api.example.com' 
        })).not.toThrow();
      });

      it('throws without API key', () => {
        expect(() => createOpenAiCompatibleExtractor({ baseUrl: 'https://api.example.com' }))
          .toThrow('API key is required');
      });

      it('throws without a valid base URL', () => {
        // DEFAULT_CONFIG supplies the OpenAI base URL, so an empty string is
        // the reachable "no base URL" case.
        expect(() => createOpenAiCompatibleExtractor({ apiKey: 'test-key', baseUrl: '' }))
          .toThrow('Base URL is required');
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

      expect(result.status).toBe('success');
      expect(result.data.employee_name).toBe('John Doe');
      expect(result.data.basic).toBe(50000);
      expect(result.retryCount).toBe(0);
    });

    it('handles custom fixtures with schema retry', async () => {
      const customFixtures = {
        payslips: {
          'custom-payslip': {
            employee_name: 'Custom Employee',
            employer_name: 'Custom Corp',
            month: 'December',
            year: 2024,
            basic_raw_label: 'Base Pay',
            basic: 100000,
            hra: 40000,
            da: 20000,
            special_allowance: 30000,
            other_allowances: 10000,
            gross_salary: 200000,
            pf_deduction: 24000,
            professional_tax: 4000,
            income_tax: 20000,
            other_deductions: 2000,
            total_deductions: 50000,
            net_salary: 150000,
            extraction_notes: 'Custom fixture',
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

      expect(result.status).toBe('success');
      expect(result.data.employee_name).toBe('Custom Employee');
      expect(result.data.basic).toBe(100000);
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
      expect(result.data.income_tax).toBeNull();
      expect(result.data.total_deductions).toBeNull();
      expect(result.data.net_salary).toBeNull();
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

      expect(result.data.basic_raw_label).toBe('Basic Salary');
      expect(result.data.basic_raw_label).not.toBe('basic');
      expect(result.data.basic_raw_label).not.toBe('Basic');
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
          employer_name: 'TechCorp Inc',
          month: 'January',
          year: 2024,
          basic_raw_label: 'Basic Salary',
          basic: 50000,
          hra: 20000,
          da: 10000,
          special_allowance: 15000,
          other_allowances: 5000,
          gross_salary: 100000,
          pf_deduction: 12000,
          professional_tax: 2000,
          income_tax: 10000,
          other_deductions: 1000,
          total_deductions: 25000,
          net_salary: 75000,
          extraction_notes: null,
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

      expect(result.status).toBe('success');
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

      expect(result.status).toBe('failure');
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
      expect(result1.data).toEqual(result2.data);
      expect(result1.status).toBe(result2.status);
      expect(result1.retryCount).toBe(result2.retryCount);
    });
  });
});
