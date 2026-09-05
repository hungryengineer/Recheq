import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_CORPUS_SIZE,
  findMissingPdfPaths,
  listExtractionLabels,
  listGeneratedPdfTargets,
  resolvePdfPath,
  type CorpusPaths,
} from '../lib/extraction-corpus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const paths: CorpusPaths = {
  fixturesDir: path.join(ROOT, 'fixtures', 'extraction'),
  documentsDir: path.join(ROOT, 'fixtures', 'documents'),
  templatesDir: path.join(ROOT, 'docs', 'diverse_salary_slip_templates'),
};

describe('extraction-corpus', () => {
  it('maps payslip-clean-02.json to fixtures/documents/clean-02/payslip.pdf', () => {
    const resolved = resolvePdfPath('payslip-clean-02.json', paths);
    expect(resolved.pdfPath).toBe(path.join(paths.documentsDir, 'clean-02', 'payslip.pdf'));
    expect(resolved.source).toBe('generated');
  });

  it('maps payslip-template-01.json to docs/diverse_salary_slip_templates/salary_slip_template_1.pdf', () => {
    const resolved = resolvePdfPath('payslip-template-01.json', paths);
    expect(resolved.pdfPath).toBe(path.join(paths.templatesDir, 'salary_slip_template_1.pdf'));
    expect(resolved.source).toBe('template');
  });

  it('lists 16 extraction labels once template fixtures exist', () => {
    const labels = listExtractionLabels(paths.fixturesDir);
    expect(labels).toHaveLength(EXPECTED_CORPUS_SIZE);
  });

  it('every extraction label has a resolvable PDF on disk', () => {
    const labels = listExtractionLabels(paths.fixturesDir);
    const missing = findMissingPdfPaths(labels, paths, fs.existsSync);
    expect(missing).toEqual([]);
  });

  it('lists 11 generated PDF targets for the base corpus', () => {
    const baseLabels = listExtractionLabels(paths.fixturesDir).filter(
      (label) => !label.startsWith('payslip-template-'),
    );
    const targets = listGeneratedPdfTargets(baseLabels, paths);
    expect(targets).toHaveLength(11);
  });
});
