import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EpfoProvider, EpfoHistory } from './epfo-provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../../../fixtures/epfo');

/** UAN → fixture filename mapping */
const UAN_MAP: Record<string, string> = {
  '100000000001': 'clean-history.json',
  '100000000002': 'anomalous-history.json',
  '100123456789': 'arun-doctored.json',
  '100123456799': 'dual-employment.json',
};

export class FixtureEpfoProvider implements EpfoProvider {
  private async loadFixture(filename: string): Promise<EpfoHistory> {
    const fixturePath = path.join(FIXTURES_DIR, filename);
    const content = await fs.readFile(fixturePath, 'utf-8');
    return JSON.parse(content) as EpfoHistory;
  }

  async fetchEmploymentHistory(uan: string, _consentId: string): Promise<EpfoHistory | null> {
    const filename = UAN_MAP[uan];
    if (filename) {
      return this.loadFixture(filename);
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
