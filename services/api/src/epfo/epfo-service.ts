import type { EpfoProvider, EpfoHistory } from './epfo-provider.js';

export interface EpfoServiceDeps {
  db: {
    createPendingRecord: (caseId: string, consentId: string, uan: string) => Promise<string>;
    updateRecordSuccess: (id: string, history: EpfoHistory) => Promise<void>;
    updateRecordFailure: (id: string, error: string) => Promise<void>;
  };
  epfoProvider: EpfoProvider;
}

/**
 * Initiates an EPFO fetch for a specific case and consent, orchestrating
 * the provider and saving the results to the database.
 */
export async function syncEpfoHistory(
  deps: EpfoServiceDeps,
  caseId: string,
  consentId: string,
  uan: string,
): Promise<{ ok: boolean; recordId: string; error?: string }> {
  // Create pending record
  const recordId = await deps.db.createPendingRecord(caseId, consentId, uan);

  try {
    const history = await deps.epfoProvider.fetchEmploymentHistory(uan, consentId);

    if (history) {
      await deps.db.updateRecordSuccess(recordId, history);
      return { ok: true, recordId };
    } else {
      await deps.db.updateRecordFailure(recordId, 'EPFO history not found for UAN');
      return { ok: false, recordId, error: 'EPFO history not found for UAN' };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await deps.db.updateRecordFailure(recordId, `Provider error: ${msg}`);
    return { ok: false, recordId, error: `Provider error: ${msg}` };
  }
}
