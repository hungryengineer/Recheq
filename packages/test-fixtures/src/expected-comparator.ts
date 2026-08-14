import type { FindingInput } from '@tieout/schema';
import type { ExpectedResult } from './fixture-loader.js';

export interface ComparisonResult {
  passed: boolean;
  errors: string[];
}

/**
 * Compares actual rule runner output against expected output.
 * Ignores non-deterministic fields like IDs and timestamps if they were present.
 */
export function compareExpected(
  actualScore: number,
  actualVerdict: string,
  actualFindings: FindingInput[],
  expected: ExpectedResult,
): ComparisonResult {
  const errors: string[] = [];

  if (actualScore !== expected.score) {
    errors.push(`Score mismatch: expected ${expected.score}, got ${actualScore}`);
  }

  if (actualVerdict !== expected.verdict) {
    errors.push(`Verdict mismatch: expected ${expected.verdict}, got ${actualVerdict}`);
  }

  // Compare findings (ignoring order by sorting by rule_id)
  const sortFindings = (a: FindingInput, b: FindingInput) => a.rule_id.localeCompare(b.rule_id);

  const actualSorted = [...actualFindings].sort(sortFindings);
  const expectedSorted = [...expected.findings].sort(sortFindings);

  if (actualSorted.length !== expectedSorted.length) {
    errors.push(
      `Findings count mismatch: expected ${expectedSorted.length}, got ${actualSorted.length}`,
    );
  }

  const length = Math.min(actualSorted.length, expectedSorted.length);
  for (let i = 0; i < length; i++) {
    const act = actualSorted[i];
    const exp = expectedSorted[i];

    if (act?.rule_id !== exp?.rule_id) {
      errors.push(
        `Finding mismatch at index ${i}: expected rule ${exp?.rule_id}, got ${act?.rule_id}`,
      );
      continue;
    }

    if (act?.severity !== exp?.severity) {
      errors.push(
        `Finding ${act?.rule_id} severity mismatch: expected ${exp?.severity}, got ${act?.severity}`,
      );
    }

    if (act?.status !== exp?.status) {
      errors.push(
        `Finding ${act?.rule_id} status mismatch: expected ${exp?.status}, got ${act?.status}`,
      );
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}
