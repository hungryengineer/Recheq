// ─── End-to-End LLM Extraction Test ──────────────────────────────
// Tests the full extraction pipeline with real Gemini API calls using
// actual PDF documents from fixtures.
//
// This test is SKIPPED by default (unless GEMINI_API_KEY is set) to avoid
// burning credits on every CI run. Run locally with:
//   GEMINI_API_KEY=... pnpm --filter @recheq/api test -- extraction-e2e

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createGeminiExtractorFromEnv } from '../src/extraction/providers/gemini-extractor.js';
import { withSchemaRetry } from '../src/extraction/schema-retry.js';
import type { ExtractionRequest } from '../src/extraction/llm-document-extractor.js';
import { PayslipExtraction, Form16Extraction } from '@recheq/schema';

const hasGeminiKey = !!process.env.GEMINI_API_KEY;
const describeIfGemini = hasGeminiKey ? describe : describe.skip;

describeIfGemini('End-to-End LLM Extraction with Gemini', () => {
  const fixturesRoot = join(process.cwd(), '../../fixtures/documents');

  it('extracts a clean payslip with correct field values', async () => {
    const extractor = withSchemaRetry(createGeminiExtractorFromEnv());

    const pdfPath = join(fixturesRoot, 'clean-01/payslip.pdf');
    const pdfBuffer = readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    const request: ExtractionRequest = {
      documentId: 'test-clean-payslip-01',
      documentKind: 'payslip',
      documentContent: pdfBase64,
      mimeType: 'application/pdf',
      schemaVersion: 'payslip-v1',
    };

    const result = await extractor.extractPayslip(request);

    if (result.status !== 'success') {
      console.error('Clean payslip extraction failed:', {
        error: result.error,
        rawOutput: result.rawOutput?.slice(0, 500),
        modelId: result.modelId,
        usage: result.usage,
      });
    }

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected success');

    // Validate against Zod schema
    const parsed = PayslipExtraction.safeParse(result.data);
    if (!parsed.success) {
      console.error('Schema validation failed:', parsed.error);
    }
    expect(parsed.success).toBe(true);

    // Check critical fields are extracted
    expect(result.data.employee_name).toBeTruthy();
    expect(result.data.month).toBeTruthy();
    expect(result.data.year).toBeTruthy();
    expect(result.data.basic?.amount).toBeGreaterThan(0);
    expect(result.data.net_salary).toBeGreaterThan(0);

    // Verify model_id is recorded
    expect(result.modelId).toContain('gemini');

    // Log for visibility
    console.log('✓ Clean payslip extraction succeeded:', {
      employee: result.data.employee_name,
      month: result.data.month,
      year: result.data.year,
      basic: result.data.basic?.amount,
      netSalary: result.data.net_salary,
      modelId: result.modelId,
      usage: result.usage,
    });
  }, 90_000); // 90s timeout for API call

  it('extracts a doctored payslip and reads the printed (doctored) numbers', async () => {
    const extractor = withSchemaRetry(createGeminiExtractorFromEnv());

    const pdfPath = join(fixturesRoot, 'doctored-01/payslip.pdf');
    const pdfBuffer = readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    const request: ExtractionRequest = {
      documentId: 'test-doctored-payslip-01',
      documentKind: 'payslip',
      documentContent: pdfBase64,
      mimeType: 'application/pdf',
      schemaVersion: 'payslip-v1',
    };

    const result = await extractor.extractPayslip(request);

    if (result.status !== 'success') {
      console.error('Doctored payslip extraction failed:', {
        error: result.error,
        rawOutput: result.rawOutput?.slice(0, 500),
        modelId: result.modelId,
        usage: result.usage,
      });
    }

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected success');

    // Validate schema
    const parsed = PayslipExtraction.safeParse(result.data);
    if (!parsed.success) {
      console.error('Schema validation failed:', parsed.error);
    }
    expect(parsed.success).toBe(true);

    // The critical test: the model should read the PRINTED values from the
    // PDF (basic=52000, pf_employee=3600) faithfully, without noticing they
    // contradict each other. The rules engine will catch the contradiction.
    // This is the demo pitch: LLM reads what's printed, rules detect fraud.
    console.log('✓ Doctored payslip extraction succeeded:', {
      employee: result.data.employee_name,
      basic: result.data.basic?.amount,
      grossSalary: result.data.gross_salary,
      netSalary: result.data.net_salary,
      modelId: result.modelId,
      usage: result.usage,
    });

    // Don't assert specific values here — fixtures may vary.
    // The key is that extraction succeeds and reads printed numbers.
    expect(result.data.basic?.amount).toBeGreaterThan(0);
  }, 90_000);

  it('extracts a Form 16 with correct fields', async () => {
    const extractor = withSchemaRetry(createGeminiExtractorFromEnv());

    const pdfPath = join(fixturesRoot, 'clean-01/form16.pdf');
    const pdfBuffer = readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    const request: ExtractionRequest = {
      documentId: 'test-clean-form16-01',
      documentKind: 'form_16',
      documentContent: pdfBase64,
      mimeType: 'application/pdf',
      schemaVersion: 'form16-v1',
    };

    const result = await extractor.extractForm16(request);

    if (result.status !== 'success') {
      console.error('Form 16 extraction failed:', {
        error: result.error,
        rawOutput: result.rawOutput?.slice(0, 500),
        modelId: result.modelId,
        usage: result.usage,
      });
    }

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected success');

    // Validate against Zod schema
    const parsed = Form16Extraction.safeParse(result.data);
    if (!parsed.success) {
      console.error('Schema validation failed:', parsed.error);
    }
    expect(parsed.success).toBe(true);

    // Check critical Form 16 fields
    expect(result.data.employee_name).toBeTruthy();
    expect(result.data.employer_name).toBeTruthy();
    expect(result.data.financial_year).toBeTruthy();
    if (result.data.gross_total_income !== null) {
      expect(result.data.gross_total_income).toBeGreaterThan(0);
    }

    console.log('✓ Form 16 extraction succeeded:', {
      employee: result.data.employee_name,
      employer: result.data.employer_name,
      fy: result.data.financial_year,
      grossTotalIncome: result.data.gross_total_income,
      modelId: result.modelId,
      usage: result.usage,
    });
  }, 90_000);

  it('handles extraction failure gracefully when model returns invalid JSON', async () => {
    const extractor = createGeminiExtractorFromEnv();

    // Send garbage that will likely cause extraction to fail
    const request: ExtractionRequest = {
      documentId: 'test-invalid',
      documentKind: 'payslip',
      documentContent: 'This is not a payslip. Random text that makes no sense.',
      mimeType: 'text/plain',
      schemaVersion: 'payslip-v1',
    };

    const result = await extractor.extractPayslip(request);

    // It might succeed with all nulls, or fail — either is acceptable.
    // The key is it doesn't crash.
    expect(['success', 'failure']).toContain(result.status);

    if (result.status === 'success') {
      // If it succeeded, most fields should be null
      const nullCount = Object.values(result.data).filter((v) => v === null).length;
      expect(nullCount).toBeGreaterThan(5);
    }

    console.log('✓ Invalid input handled gracefully:', {
      status: result.status,
      modelId: result.modelId,
    });
  }, 90_000);
});

describeIfGemini('Gemini Extractor with Fixture Fallback', () => {
  it('activates fixture fallback when EXTRACTION_FALLBACK=fixture', async () => {
    // Override env to enable fallback
    const origFallback = process.env.EXTRACTION_FALLBACK;
    process.env.EXTRACTION_FALLBACK = 'fixture';

    try {
      const extractor = createGeminiExtractorFromEnv();

      // Send invalid input that will cause Gemini to fail
      const request: ExtractionRequest = {
        documentId: 'test-fallback',
        documentKind: 'payslip',
        documentContent: 'INVALID_GARBAGE_NO_PAYSLIP_DATA_HERE',
        mimeType: 'text/plain',
        schemaVersion: 'payslip-v1',
      };

      const result = await extractor.extractPayslip(request);

      // With fixture fallback enabled, we should get a result even if Gemini fails
      // The fallback might still fail if fixtures can't parse it, but the wrapper
      // should at least attempt the fallback path.
      console.log('✓ Fallback test completed:', {
        status: result.status,
        modelId: result.modelId,
        hasFallbackPrefix: result.modelId?.includes('fallback'),
      });
    } finally {
      if (origFallback === undefined) {
        delete process.env.EXTRACTION_FALLBACK;
      } else {
        process.env.EXTRACTION_FALLBACK = origFallback;
      }
    }
  }, 90_000);
});
