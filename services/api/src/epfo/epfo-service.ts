import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { epfoRecords } from '../db/schema/epfo-records.js';
import type { EpfoProvider } from './epfo-provider.js';
import { FixtureEpfoProvider } from './fixture-epfo-provider.js';

// Instantiate the provider (in a real app, this would be injected)
const epfoProvider: EpfoProvider = new FixtureEpfoProvider();

/**
 * Initiates an EPFO fetch for a specific case and consent, orchestrating
 * the provider and saving the results to the database.
 */
export async function syncEpfoHistory(
  db: Database,
  caseId: string,
  consentId: string,
  uan: string,
): Promise<string> {
  // Create pending record
  const [record] = await db
    .insert(epfoRecords)
    .values({
      case_id: caseId,
      consent_id: consentId,
      uan,
      status: 'pending',
    })
    .returning({ id: epfoRecords.id });

  if (!record) {
    throw new Error('Failed to create EPFO record');
  }

  const recordId = record.id;

  try {
    const history = await epfoProvider.fetchEmploymentHistory(uan, consentId);

    if (history) {
      await db
        .update(epfoRecords)
        .set({
          status: 'completed',
          employment_history: history,
          completed_at: new Date(),
        })
        .where(eq(epfoRecords.id, recordId));
    } else {
      await db
        .update(epfoRecords)
        .set({
          status: 'failed',
          error_message: 'EPFO history not found for UAN',
          completed_at: new Date(),
        })
        .where(eq(epfoRecords.id, recordId));
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await db
      .update(epfoRecords)
      .set({
        status: 'failed',
        error_message: `Provider error: ${msg}`,
        completed_at: new Date(),
      })
      .where(eq(epfoRecords.id, recordId));
  }

  return recordId;
}
