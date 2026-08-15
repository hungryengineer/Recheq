import type { EventInput, EventRecord, CaseStatus } from '@tieout/schema';
import { notFoundError } from '../../http/errors.js';
import { transitionCaseStatus } from '../../domain/case-status.js';

export interface ReprocessServiceDeps {
  db: {
    getCaseById: (caseId: string) => Promise<{ id: string; status: CaseStatus } | null>;
    updateCaseStatus: (caseId: string, status: CaseStatus) => Promise<void>;
  };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<EventRecord>;
  };
  worker: {
    enqueueProcessCase: (caseId: string) => Promise<void>;
  };
}

/**
 * Triggers a reprocessing of the case by the verifier.
 * This transitions the case back to 'processing' and enqueues a worker job.
 */
export async function requestReprocess(caseId: string, deps: ReprocessServiceDeps): Promise<void> {
  const caseRecord = await deps.db.getCaseById(caseId);
  if (!caseRecord) {
    throw notFoundError(`Case ${caseId} not found`);
  }

  // Transition case status - will throw INVALID_TRANSITION if not allowed
  const newStatus = transitionCaseStatus(caseRecord.status, 'processing_started');

  await deps.db.updateCaseStatus(caseId, newStatus);

  await deps.audit.appendEvent(null, {
    case_id: caseId,
    kind: 'case_reprocessed',
    payload: {
      previous_status: caseRecord.status,
    },
    actor: 'verifier'
  });

  // Enqueue job for background worker
  await deps.worker.enqueueProcessCase(caseId);
}
