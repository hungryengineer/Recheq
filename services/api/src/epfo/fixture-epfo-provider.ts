import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EpfoHistorySchema, type EpfoProvider, type EpfoHistory } from './epfo-provider.js';

import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walk up from this module until a pnpm workspace marker is found. Required
 * because @recheq/api is consumed via its exports map (./dist/src/*), so a
 * fixed number of `..` segments resolves differently from src and from dist.
 *
 * Returns null when no marker exists up the chain (e.g. a serverless bundle
 * where the repo files are not on disk) instead of throwing, so importing
 * this module never fails and downstream API routes keep loading.
 */
export function findRepoRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

let _fixturesDir: string | null | undefined;
function getFixturesDir(): string | null {
  if (_fixturesDir !== undefined) return _fixturesDir;
  if (process.env.EPFO_FIXTURES_DIR) {
    _fixturesDir = process.env.EPFO_FIXTURES_DIR;
    return _fixturesDir;
  }
  const root = findRepoRoot(__dirname);
  _fixturesDir = root ? path.join(root, 'fixtures/epfo') : null;
  if (!_fixturesDir) {
    console.warn(
      '[epfo] Fixture directory unavailable (EPFO_FIXTURES_DIR unset and repo root not found); fixture lookups will resolve to null.',
    );
  }
  return _fixturesDir;
}

/** UAN → fixture filename mapping */
const UAN_MAP: Record<string, string> = {
  '100000000001': 'clean-history.json',
  '100000000002': 'anomalous-history.json',
  '100123456789': 'arun-doctored.json',
  '100123456799': 'dual-employment.json',
};

export class FixtureEpfoProvider implements EpfoProvider {
  readonly sourceId = 'epfo:fixture';

  private async loadFixture(filename: string): Promise<EpfoHistory | null> {
    const fixturesDir = getFixturesDir();
    if (!fixturesDir) return null;
    const fixturePath = path.join(fixturesDir, filename);
    const content = await fs.readFile(fixturePath, 'utf-8');
    const parsed = EpfoHistorySchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      throw new Error(`Invalid EPFO fixture ${filename}: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  async fetchEmploymentHistory(uan: string, _consentId: string): Promise<EpfoHistory | null> {
    const filename = UAN_MAP[uan];
    if (filename) {
      return this.loadFixture(filename);
    }

    // An unknown UAN has no fixture backing it. Returning fabricated data here
    // would let synthetic records count as an independent evidence origin in
    // evidence-service, producing a confident verdict from invented facts.
    // Returning null makes syncEpfoHistory record a failure, which the workflow
    // step maps to not_assessed.
    if (process.env.DEMO_MODE !== 'true') {
      return null;
    }

    // Deterministic synthetic history for any unknown UAN.
    // Never returns null so a live-typed UAN cannot crash the demo.
    return {
      uan,
      periods: [
        {
          employerName: 'Unknown Employer',
          establishmentId: 'XX/XXX/00000',
          startDate: '2023-01-01',
          endDate: null,
          contributions: [{ month: '2026-03', employee_share: 0, employer_share: 0 }],
        },
      ],
    };
  }
}
