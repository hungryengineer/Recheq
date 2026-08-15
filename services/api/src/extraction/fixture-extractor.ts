// ─── Fixture Document Extractor ────────────────────────────────
// Deterministic extractor for testing that uses fixture data instead of real LLMs

import type {
  LlmDocumentExtractor,
  ExtractionRequest,
  ExtractionResult,
} from './llm-document-extractor.js';
import type { PayslipExtraction, Form16Extraction } from '@tieout/schema';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fixturesPath = path.resolve(__dirname, '../../../../fixtures/extraction');

  const readJson = (filename: string) => {
    try {
      const content = fs.readFileSync(path.join(fixturesPath, filename), 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.warn(`Could not load fixture ${filename}`, err);
      return {};
    }
  };

  return {
    payslips: {
      'clean-payslip-1': readJson('payslip-clean-01.json'),
      'partial-payslip-1': readJson('payslip-clean-02.json'),
      'forged-payslip-1': readJson('payslip-doctored-01.json'),
    },
    form16s: {
      'clean-form16-1': readJson('form16-clean-01.json'),
      'partial-form16-1': readJson('form16-clean-02.json'),
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
