import fs from 'node:fs/promises';
import path from 'node:path';
import type { FindingInput } from '@tieout/schema';
import type { CheckContext } from '@tieout/rules';

export interface FixtureCase {
  id: string;
  context: CheckContext;
}

export interface ExpectedResult {
  score: number;
  verdict: string;
  findings: FindingInput[];
}

export interface TestCase {
  name: string;
  fixture: FixtureCase;
  expected: ExpectedResult;
}

/**
 * Loads all fixtures and expected JSON files from a given base path.
 */
export async function loadFixtures(basePath: string): Promise<TestCase[]> {
  const expectedDir = path.join(basePath, 'expected');
  const inputDir = path.join(basePath, 'inputs');

  const tests: TestCase[] = [];

  try {
    const files = await fs.readdir(expectedDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const expectedPath = path.join(expectedDir, file);
      const inputPath = path.join(inputDir, file);

      try {
        const expectedData = JSON.parse(await fs.readFile(expectedPath, 'utf8'));
        const inputData = JSON.parse(await fs.readFile(inputPath, 'utf8'));

        tests.push({
          name: file,
          fixture: inputData as FixtureCase,
          expected: expectedData as ExpectedResult,
        });
      } catch {
        console.warn(`[WARNING] Skipping fixture ${file}: Could not read input/expected pairs.`);
      }
    }
  } catch {
    console.warn(`[WARNING] Could not read fixtures directory at ${expectedDir}`);
  }

  return tests;
}
