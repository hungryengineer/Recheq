/**
 * RCQ-140: Precision, recall and categorised failure modes
 * Evaluates the extraction engine against the labelled fixtures corpus.
 *
 * Usage: npx tsx scripts/evaluate-extraction.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pdfParse from 'pdf-parse';
import {
  createGeminiExtractorFromEnv,
  DEFAULT_EXTRACTION_MODEL,
} from '../services/api/src/extraction/providers/gemini-extractor.js';
import { evaluateExtraction, FailureMode } from '../services/api/src/extraction/evaluator.js';
import type { ExtractionRequest } from '../services/api/src/extraction/llm-document-extractor.js';
import {
  findMissingPdfPaths,
  listExtractionLabels,
  resolvePdfPath,
} from './lib/extraction-corpus.js';
import {
  buildEvaluationReport,
  formatEvaluationReport,
  formatTokenSummary,
  rowFromEvaluation,
} from './lib/evaluation-report.js';
import { loadEnvFile } from './lib/load-env.js';

loadEnvFile('.env.local', ['GEMINI_API_KEY']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'fixtures', 'extraction');
const DOCUMENTS_DIR = path.join(PROJECT_ROOT, 'fixtures', 'documents');
const TEMPLATES_DIR = path.join(PROJECT_ROOT, 'docs', 'diverse_salary_slip_templates');
const REPORT_PATH = path.join(PROJECT_ROOT, 'docs', 'extraction-evaluation-results.md');
const TOKEN_SUMMARY_PATH = path.join(PROJECT_ROOT, 'docs', '.evaluation-token-summary.json');

const corpusPaths = {
  fixturesDir: FIXTURES_DIR,
  documentsDir: DOCUMENTS_DIR,
  templatesDir: TEMPLATES_DIR,
};

async function readPdfText(pdfPath: string): Promise<string> {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  return pdfData.text;
}

export async function runExtractionEvaluation(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Evaluation Run: Extraction Reliability (RCQ-140)    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error('❌ Fixtures directory not found.');
    process.exit(1);
  }

  const labels = listExtractionLabels(FIXTURES_DIR);
  const missing = findMissingPdfPaths(labels, corpusPaths);

  if (missing.length > 0) {
    console.error('❌ Corpus incomplete — missing PDFs:');
    missing.forEach((pdfPath) => console.error(`   - ${pdfPath}`));
    console.error('\nRun `pnpm generate:fixtures` for generated documents first.');
    process.exit(1);
  }

  delete process.env.EXTRACTION_FALLBACK;
  if (!process.env.EXTRACTION_MODEL || process.env.EXTRACTION_MODEL === 'gemini-2.5-flash') {
    process.env.EXTRACTION_MODEL = DEFAULT_EXTRACTION_MODEL;
  }

  const extractor = createGeminiExtractorFromEnv();
  const rows = [];

  for (const labelFile of labels) {
    console.log(`\n📄 Evaluating: ${labelFile}`);

    const expected = JSON.parse(
      fs.readFileSync(path.join(FIXTURES_DIR, labelFile), 'utf8'),
    ) as Record<string, unknown>;

    const resolved = resolvePdfPath(labelFile, corpusPaths);
    const pdfText = await readPdfText(resolved.pdfPath);
    const documentKind = resolved.docType === 'form16' ? 'form_16' : 'payslip';

    const request: ExtractionRequest = {
      documentId: labelFile.replace('.json', ''),
      documentKind,
      documentContent: pdfText,
      mimeType: 'text/plain',
      schemaVersion:
        typeof expected.schema_version === 'string'
          ? expected.schema_version
          : `${resolved.docType}-v1`,
    };

    const result =
      resolved.docType === 'payslip'
        ? await extractor.extractPayslip(request)
        : await extractor.extractForm16(request);

    const actualResult = result.status === 'success' ? result.data : {};
    const evalResult = evaluateExtraction(expected, actualResult);
    const usage = result.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    rows.push(
      rowFromEvaluation(labelFile, evalResult, {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      }),
    );

    console.log(
      `   ✓ Precision: ${(evalResult.precision * 100).toFixed(1)}% | Recall: ${(evalResult.recall * 100).toFixed(1)}%`,
    );
    if (evalResult.failures.length > 0) {
      console.log(`   ⚠️ ${evalResult.failures.length} failures detected.`);
    }
  }

  const report = buildEvaluationReport(rows);

  console.log('\n=============================================================');
  console.log('📊 AGGREGATE RELIABILITY METRICS (OVER LABELLED CORPUS)');
  console.log('=============================================================');
  console.log(`Total True Positives  : ${report.totalTruePositives}`);
  console.log(`Total False Positives : ${report.totalFalsePositives}`);
  console.log(`Total False Negatives : ${report.totalFalseNegatives}`);
  console.log(`Overall Precision     : ${(report.overallPrecision * 100).toFixed(2)}%`);
  console.log(`Overall Recall        : ${(report.overallRecall * 100).toFixed(2)}%`);

  console.log('\n⚠️ CATEGORISED FAILURE MODES:');
  Object.values(FailureMode).forEach((mode) => {
    console.log(`- ${mode}: ${report.failureCounts[mode]}`);
  });

  fs.writeFileSync(REPORT_PATH, formatEvaluationReport(report));
  fs.writeFileSync(TOKEN_SUMMARY_PATH, formatTokenSummary(report));
  console.log(`\n📝 Report written to ${path.relative(PROJECT_ROOT, REPORT_PATH)}`);
}

async function main() {
  try {
    await runExtractionEvaluation();
  } catch (err) {
    console.error('Fatal evaluation error:', err);
    process.exit(1);
  }
}

void main();
