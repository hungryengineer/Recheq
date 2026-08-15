import fs from 'node:fs/promises';
import path from 'node:path';
import type { EpfoProvider, EpfoHistory } from './epfo-provider.js';

import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class FixtureEpfoProvider implements EpfoProvider {
  private async loadFixture(filename: string): Promise<EpfoHistory> {
    const fixturePath = path.resolve(__dirname, '../../../../fixtures/epfo', filename);
    const content = await fs.readFile(fixturePath, 'utf-8');
    return JSON.parse(content) as EpfoHistory;
  }

  async fetchEmploymentHistory(uan: string, _consentId: string): Promise<EpfoHistory | null> {
    if (uan === '100000000001') {
      return this.loadFixture('clean-history.json');
    }
    if (uan === '100000000002') {
      return this.loadFixture('anomalous-history.json');
    }
    if (uan === '100123456789') {
      return this.loadFixture('arun-doctored.json');
    }
    if (uan === '100123456799') {
      return this.loadFixture('dual-employment.json');
    }

    // Deterministic synthetic history for any unknown UAN — never crashes the demo
    return {
      uan,
      periods: [
        {
          employerName: 'Unknown Employer',
          establishmentId: 'XX/XXX/00000',
          startDate: '2023-01-01',
          endDate: null,
        },
      ],
    };
  }
}
