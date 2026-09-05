import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PayslipExtraction } from '@recheq/schema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/extraction');

function readFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8')) as unknown;
}

describe('template fixtures', () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const fileName = `payslip-template-0${n}.json`;

    it(`${fileName} parses against PayslipExtraction`, () => {
      const raw = readFixture(fileName) as Record<string, unknown>;
      const { _fixture, _description, ...data } = raw;
      expect(_fixture).toBeDefined();
      expect(PayslipExtraction.parse(data)).toBeDefined();
    });
  }
});
