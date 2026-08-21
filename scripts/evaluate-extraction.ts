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
import { GeminiExtractor } from '../services/api/src/extraction/providers/gemini-extractor.js';
import {
  evaluateExtraction,
  FailureMode,
  type Failure,
} from '../services/api/src/extraction/evaluator.js';
import type { ExtractionRequest } from '../services/api/src/extraction/llm-document-extractor.js';

// Load environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// For this evaluation, we can use the Mock/Fixture Extractor to test the evaluator,
// or we can plug in AnthropicExtractor/OpenAIExtractor. To avoid making real API calls
// by default and costing money on CI, we'll use FixtureExtractor for dry runs or
// a Mock LLM output that intentionally introduces some errors to demonstrate the failure modes.

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Evaluation Run: Extraction Reliability (RCQ-140)    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const fixturesDir = path.join(PROJECT_ROOT, 'fixtures', 'extraction');
  const documentsDir = path.join(PROJECT_ROOT, 'fixtures', 'documents');

  if (!fs.existsSync(fixturesDir) || !fs.existsSync(documentsDir)) {
    console.error('❌ Fixtures directory not found.');
    process.exit(1);
  }

  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

  let totalTP = 0;
  let totalFP = 0;
  let totalFN = 0;
  const allFailures: (Failure & { document: string })[] = [];

  // Initialize the real LLM extractor
  const extractor = new GeminiExtractor();

  for (const file of files) {
    console.log(`\n📄 Evaluating: ${file}`);

    // Parse the expected label
    const expectedContent = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
    const expected = JSON.parse(expectedContent);

    // Infer the document path
    // E.g. payslip-clean-01.json -> clean-01/payslip.pdf
    let docType = 'payslip';
    let docDir = file.replace('.json', '');

    if (file.startsWith('payslip-')) {
      docType = 'payslip';
      docDir = file.replace('payslip-', '').replace('.json', '');
    } else if (file.startsWith('form16-')) {
      docType = 'form16';
      docDir = file.replace('form16-', '').replace('.json', '');
    }

    const pdfPath = path.join(documentsDir, docDir, `${docType}.pdf`);
    let pdfText = '';

    if (fs.existsSync(pdfPath)) {
      try {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdfParse(pdfBuffer);
        pdfText = pdfData.text;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`   ⚠️ Error parsing PDF at ${pdfPath}: ${message}`);
        pdfText = 'mock text fallback';
      }
    } else {
      console.warn(`   ⚠️ Source PDF not found at ${pdfPath}, skipping extraction logic...`);
      // We still run evaluation by simulating actual extraction equal to expected
      pdfText = 'mock text';
    }

    // Prepare extraction request
    const documentKind = docType === 'form16' ? 'form_16' : 'payslip';

    const request: ExtractionRequest = {
      documentId: file.replace('.json', ''),
      documentKind,
      documentContent: pdfText,
      mimeType: 'application/pdf',
      schemaVersion: expected.schema_version || `${docType}-v1`,
    };

    // Run extraction
    let actualResult: unknown;
    if (docType === 'payslip') {
      const result = await extractor.extractPayslip(request);
      actualResult = result.status === 'success' ? result.data : {};
    } else {
      const result = await extractor.extractForm16(request);
      actualResult = result.status === 'success' ? result.data : {};
    }

    // Evaluate
    const evalResult = evaluateExtraction(expected, actualResult);

    totalTP += evalResult.truePositives;
    totalFP += evalResult.falsePositives;
    totalFN += evalResult.falseNegatives;

    evalResult.failures.forEach((f) => {
      allFailures.push({ ...f, document: file });
    });

    console.log(
      `   ✓ Precision: ${(evalResult.precision * 100).toFixed(1)}% | Recall: ${(evalResult.recall * 100).toFixed(1)}%`,
    );
    if (evalResult.failures.length > 0) {
      console.log(`   ⚠️ ${evalResult.failures.length} failures detected.`);
    }
  }

  // Final Report
  console.log('\n=============================================================');
  console.log('📊 AGGREGATE RELIABILITY METRICS (OVER LABELLED CORPUS)');
  console.log('=============================================================');

  const overallPrecision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const overallRecall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;

  console.log(`Total True Positives  : ${totalTP}`);
  console.log(`Total False Positives : ${totalFP}`);
  console.log(`Total False Negatives : ${totalFN}`);
  console.log(`Overall Precision     : ${(overallPrecision * 100).toFixed(2)}%`);
  console.log(`Overall Recall        : ${(overallRecall * 100).toFixed(2)}%`);

  console.log('\n⚠️ CATEGORISED FAILURE MODES:');
  const failureCounts: Record<string, number> = {
    [FailureMode.MISSING_FIELD]: 0,
    [FailureMode.HALLUCINATED_FIELD]: 0,
    [FailureMode.VALUE_MISMATCH]: 0,
    [FailureMode.TYPE_MISMATCH]: 0,
  };

  allFailures.forEach((f) => {
    failureCounts[f.mode]++;
  });

  Object.entries(failureCounts).forEach(([mode, count]) => {
    console.log(`- ${mode}: ${count}`);
  });

  if (allFailures.length > 0) {
    console.log('\nTop 5 Failure Examples:');
    allFailures.slice(0, 5).forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.document}] ${f.path} -> ${f.mode}`);
      if (f.expected !== undefined) console.log(`       Expected: ${JSON.stringify(f.expected)}`);
      if (f.actual !== undefined) console.log(`       Actual: ${JSON.stringify(f.actual)}`);
    });
  }
}

main().catch((err) => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});
