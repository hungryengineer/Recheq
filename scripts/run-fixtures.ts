import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures, compareExpected } from '@recheq/test-fixtures';
import {
  runAllChecks,
  calculateRiskScore,
  calculateVerdict,
  type ScorableFinding,
} from '@recheq/rules';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

/**
 * Runs every fixture through the rules engine, compares score/verdict/findings
 * against the expected results, and exits non-zero on any failure or when no
 * fixtures are found.
 */
async function run() {
  console.log('🔍 Running Tieout Fixture Validations...');

  const tests = await loadFixtures(FIXTURES_DIR);
  if (tests.length === 0) {
    console.error('⚠️  No fixtures found in ' + FIXTURES_DIR);
    console.error('    Expected fixtures/inputs/*.json paired with fixtures/expected/*.json.');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\nEvaluating: ${test.name}`);

    // 1. Run checks
    const findings = runAllChecks(test.fixture.context);

    // 2. Calculate score
    const scorableFindings = findings.map((f) => ({
      status: f.status,
      severity: f.severity,
    })) as ScorableFinding[];
    const score = calculateRiskScore(scorableFindings);

    const verdict = calculateVerdict(
      scorableFindings,
      test.fixture.context.assembly.origins.length,
    );

    const comparison = compareExpected(score, verdict, findings, test.expected);

    if (comparison.passed) {
      console.log(`✅ Passed (${findings.length} findings, score: ${score})`);
      passed++;
    } else {
      console.error(`❌ Failed:`);
      comparison.errors.forEach((e: string) => console.error(`   - ${e}`));
      failed++;
    }
  }

  console.log('\n----------------------------------------');
  if (failed > 0) {
    console.error(`💥 ${failed} out of ${tests.length} fixture checks failed!`);
    process.exit(1);
  } else {
    console.log(`🎉 ${passed}/${tests.length} passed`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal error during fixture run:', err);
  process.exit(1);
});
