import type { CaseStatus } from '@tieout/schema';
import { conflictError } from '../http/errors.js';

/**
 * Checks if a case is in a valid state for processing.
 * Withdrawn or already complete cases (unless explicitly reprocessed)
 * should not trigger external work.
 *
 * NOTE: This is an in-memory application logic check. If a case is in 'processing',
 * and another worker picks it up (e.g. due to visibility timeout in the queue),
 * checking status === 'processing' won't stop the duplicate execution.
 * True idempotency in a distributed worker requires either a Redis lock on the
 * caseId or a SELECT ... FOR UPDATE row lock in Postgres.
 */
export function checkProcessingIdempotency(status: CaseStatus, isReprocess: boolean): void {
  if (status === 'withdrawn') {
    throw conflictError('Cannot process a withdrawn case.');
  }

  // If it's a normal processing run, we expect the status to be 'processing'.
  // If it's complete, it might be a duplicate worker event, so we skip safely.
  if (!isReprocess && status === 'complete') {
    throw conflictError('Case is already processed. Use reprocess explicitly if needed.');
  }
}
