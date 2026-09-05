import * as fs from 'node:fs';
import * as path from 'node:path';

export const EXPECTED_CORPUS_SIZE = 16;

export interface CorpusPaths {
  fixturesDir: string;
  documentsDir: string;
  templatesDir: string;
}

export interface ResolvedDocument {
  labelFile: string;
  docType: 'payslip' | 'form16';
  pdfPath: string;
  source: 'generated' | 'template';
}

export function listExtractionLabels(fixturesDir: string): string[] {
  if (!fs.existsSync(fixturesDir)) {
    return [];
  }

  return fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
}

export function resolvePdfPath(labelFile: string, paths: CorpusPaths): ResolvedDocument {
  if (labelFile.startsWith('payslip-template-')) {
    const match = /^payslip-template-(\d+)\.json$/.exec(labelFile);
    if (!match) {
      throw new Error(`Invalid template fixture name: ${labelFile}`);
    }

    const index = Number(match[1]);
    return {
      labelFile,
      docType: 'payslip',
      pdfPath: path.join(paths.templatesDir, `salary_slip_template_${index}.pdf`),
      source: 'template',
    };
  }

  let docType: 'payslip' | 'form16';
  let docDir: string;

  if (labelFile.startsWith('payslip-')) {
    docType = 'payslip';
    docDir = labelFile.replace('payslip-', '').replace('.json', '');
  } else if (labelFile.startsWith('form16-')) {
    docType = 'form16';
    docDir = labelFile.replace('form16-', '').replace('.json', '');
  } else {
    throw new Error(`Unrecognised extraction fixture: ${labelFile}`);
  }

  return {
    labelFile,
    docType,
    pdfPath: path.join(paths.documentsDir, docDir, `${docType}.pdf`),
    source: 'generated',
  };
}

export function findMissingPdfPaths(
  labels: string[],
  paths: CorpusPaths,
  exists: (filePath: string) => boolean = fs.existsSync,
): string[] {
  const missing: string[] = [];

  for (const label of labels) {
    const resolved = resolvePdfPath(label, paths);
    if (!exists(resolved.pdfPath)) {
      missing.push(resolved.pdfPath);
    }
  }

  return missing;
}

export function listGeneratedPdfTargets(labels: string[], paths: CorpusPaths): string[] {
  return labels
    .filter((label) => !label.startsWith('payslip-template-'))
    .map((label) => resolvePdfPath(label, paths).pdfPath);
}
