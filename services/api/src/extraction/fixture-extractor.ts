// ─── Fixture Document Extractor ────────────────────────────────
// Deterministic extractor for testing that uses fixture data instead of real LLMs

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from './llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';

interface FixtureData {
  payslips: Record<string, PayslipExtraction>;
  form16s: Record<string, Form16Extraction>;
}

/**
 * Deterministic fixture extractor for testing
 * Uses pre-defined fixture data keyed by document ID
 */
export class FixtureExtractor implements LlmDocumentExtractor {
  readonly provider = 'fixture';
  readonly supportsStreaming = false;

  constructor(private readonly fixtures: FixtureData = createDefaultFixtures()) {}

  async extractPayslip(request: ExtractionRequest): Promise<ExtractionResult<PayslipExtraction>> {
    const startTime = Date.now();

    const fixture = this.fixtures.payslips[request.documentId];

    if (!fixture) {
      return this.createErrorResult<PayslipExtraction>(
        request,
        `No fixture found for payslip document ID: ${request.documentId}`,
        'fixture-missing',
      );
    }

    const result: ExtractionResult<PayslipExtraction> = {
      data: fixture,
      rawOutput: JSON.stringify(fixture, null, 2),
      modelId: 'fixture-v1',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      extractionDurationMs: Date.now() - startTime,
      status: 'success',
      retryCount: request.retryContext ? 1 : 0,
    };

    return result;
  }

  async extractForm16(request: ExtractionRequest): Promise<ExtractionResult<Form16Extraction>> {
    const startTime = Date.now();

    const fixture = this.fixtures.form16s[request.documentId];

    if (!fixture) {
      return this.createErrorResult<Form16Extraction>(
        request,
        `No fixture found for Form 16 document ID: ${request.documentId}`,
        'fixture-missing',
      );
    }

    const result: ExtractionResult<Form16Extraction> = {
      data: fixture,
      rawOutput: JSON.stringify(fixture, null, 2),
      modelId: 'fixture-v1',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      extractionDurationMs: Date.now() - startTime,
      status: 'success',
      retryCount: request.retryContext ? 1 : 0,
    };

    return result;
  }

  getMetadata() {
    return {
      maxContentSize: 10 * 1024 * 1024, // 10MB
      supportsImages: false,
      supportsPdfText: false,
      costPer1kTokens: 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true; // Fixture extractor is always available
  }

  private createErrorResult<T>(
    request: ExtractionRequest,
    errorMessage: string,
    modelId: string,
  ): ExtractionResult<T> {
    return {
      data: {} as T,
      rawOutput: `{"error": "${errorMessage}"}`,
      modelId,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      extractionDurationMs: 1,
      status: 'failure',
      error: errorMessage,
      retryCount: request.retryContext ? 1 : 0,
    };
  }
}

/**
 * Create default test fixtures matching the spec requirements
 */
function createDefaultFixtures(): FixtureData {
  return {
    payslips: {
      // Clean payslip (all values present)
      'clean-payslip-1': {
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
        extraction_notes: 'Clear and legible document',
      },
      // Partial payslip (some null values)
      'partial-payslip-1': {
        employee_name: 'Jane Smith',
        employer_name: 'FinanceCo Ltd',
        month: 'February',
        year: 2024,
        basic_raw_label: 'Base Pay',
        basic: 60000,
        hra: 24000,
        da: 12000,
        special_allowance: 18000,
        other_allowances: 6000,
        gross_salary: 120000,
        pf_deduction: 14400,
        professional_tax: 2500,
        income_tax: null, // Missing/illegible
        other_deductions: 1000,
        total_deductions: null, // Missing calculation
        net_salary: null, // Missing calculation
        extraction_notes: 'Income tax section smudged',
      },
      // Forged payslip (for verification testing)
      'forged-payslip-1': {
        employee_name: 'Robert Johnson',
        employer_name: 'Innovate Systems',
        month: 'March',
        year: 2024,
        basic_raw_label: 'Basic',
        basic: 80000,
        hra: 32000,
        da: 16000,
        special_allowance: 24000,
        other_allowances: 8000,
        gross_salary: 160000,
        pf_deduction: 19200,
        professional_tax: 3000,
        income_tax: 20000,
        other_deductions: 1500,
        total_deductions: 43700,
        net_salary: 116300,
        extraction_notes: 'Document appears altered',
      },
    },
    form16s: {
      // Clean Form 16
      'clean-form16-1': {
        employee_name: 'John Doe',
        employer_name: 'TechCorp Inc',
        pan: 'ABCDE1234F',
        tan: 'BANG12345B',
        financial_year: '2023-24',
        assessment_year: '2024-25',
        gross_total_income: 1200000,
        total_tax_deducted: 120000,
        total_salary: 1200000,
        extraction_notes: 'Complete and legible',
      },
      // Partial Form 16
      'partial-form16-1': {
        employee_name: 'Jane Smith',
        employer_name: 'FinanceCo Ltd',
        pan: 'FGHIJ5678K',
        tan: null, // Missing
        financial_year: '2023-24',
        assessment_year: '2024-25',
        gross_total_income: 1440000,
        total_tax_deducted: 144000,
        total_salary: null, // Missing
        extraction_notes: 'TAN number not visible',
      },
    },
  };
}

/**
 * Helper to create a FixtureExtractor with custom fixture data
 */
export function createFixtureExtractor(customFixtures?: Partial<FixtureData>): FixtureExtractor {
  const defaultFixtures = createDefaultFixtures();
  const fixtures: FixtureData = {
    payslips: { ...defaultFixtures.payslips, ...customFixtures?.payslips },
    form16s: { ...defaultFixtures.form16s, ...customFixtures?.form16s },
  };
  return new FixtureExtractor(fixtures);
}
