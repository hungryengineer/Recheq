import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures, compareExpected } from '@tieout/test-fixtures';
import {
  runAllChecks,
  calculateRiskScore,
  calculateVerdict,
  type ScorableFinding,
} from '@tieout/rules';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

async function run() {
  console.log('🔍 Running Tieout Fixture Validations...');

  const tests = await loadFixtures(FIXTURES_DIR);
  if (tests.length === 0) {
    console.warn('⚠️  No fixtures found in ' + FIXTURES_DIR);
    process.exit(0);
  }

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
    const scoreBreakdown = calculateRiskScore(scorableFindings);

    // 3. Calculate verdict
    const verdict = calculateVerdict(scoreBreakdown.score);

    // 4. Compare
    const comparison = compareExpected(scoreBreakdown.score, verdict, findings, test.expected);

    if (comparison.passed) {
      console.log(`✅ Passed (${findings.length} findings, score: ${scoreBreakdown.score})`);
    } else {
      console.error(`❌ Failed:`);
      comparison.errors.forEach((e) => console.error(`   - ${e}`));
      failed++;
    }
  }

  console.log('\n----------------------------------------');
  if (failed > 0) {
    console.error(`💥 ${failed} out of ${tests.length} fixture checks failed!`);
    process.exit(1);
  } else {
    console.log(`🎉 All ${tests.length} fixture checks passed successfully!`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal error during fixture run:', err);
  process.exit(1);
});
