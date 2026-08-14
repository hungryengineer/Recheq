import type { CaseStatus } from '@tieout/schema';

// ─── Transition Events ─────────────────────────────────────────

/**
 * Events that can trigger a case status transition.
 */
export type TransitionEvent =
  | 'invite_sent'
  | 'consent_granted'
  | 'documents_submitted'
  | 'processing_started'
  | 'processing_complete'
  | 'employer_request_sent'
  | 'employer_responded'
  | 'withdrawn';

// ─── Transition Error ───────────────────────────────────────────

export interface InvalidTransitionError {
  readonly code: 'INVALID_TRANSITION';
  readonly from: CaseStatus;
  readonly event: TransitionEvent;
  readonly message: string;
}

// ─── Transition Result ──────────────────────────────────────────

export type TransitionResult =
  { ok: true; status: CaseStatus } | { ok: false; error: InvalidTransitionError };

// ─── Transition Table ───────────────────────────────────────────
// Each key is a current status. Each value maps events to the next status.

const TRANSITIONS: Record<CaseStatus, Partial<Record<TransitionEvent, CaseStatus>>> = {
  draft: {
    invite_sent: 'awaiting_consent',
  },
  awaiting_consent: {
    consent_granted: 'awaiting_documents',
    withdrawn: 'withdrawn',
  },
  awaiting_documents: {
    documents_submitted: 'processing',
    withdrawn: 'withdrawn',
  },
  processing: {
    processing_complete: 'complete',
    employer_request_sent: 'awaiting_employer',
    withdrawn: 'withdrawn',
  },
  awaiting_employer: {
    employer_responded: 'processing',
    processing_complete: 'complete',
    withdrawn: 'withdrawn',
  },
  complete: {
    // Reprocessing goes back to processing
    processing_started: 'processing',
  },
  withdrawn: {
    // Terminal state — no transitions out
  },
};

// ─── Transition Function ────────────────────────────────────────

/**
 * Attempt a case status transition.
 *
 * This is the ONLY function that should determine the next case status.
 * Routes and services must never assign `cases.status` directly.
 *
 * @param currentStatus - The current status of the case
 * @param event - The event triggering the transition
 * @returns A TransitionResult indicating success with new status, or failure with typed error
 */
export function transition(currentStatus: CaseStatus, event: TransitionEvent): TransitionResult {
  const allowed = TRANSITIONS[currentStatus];
  const nextStatus = allowed?.[event];

  if (nextStatus === undefined) {
    return {
      ok: false,
      error: {
        code: 'INVALID_TRANSITION',
        from: currentStatus,
        event,
        message: `Cannot transition from "${currentStatus}" via "${event}"`,
      },
    };
  }

  return { ok: true, status: nextStatus };
}

/**
 * Check if a transition is valid without performing it.
 */
export function canTransition(currentStatus: CaseStatus, event: TransitionEvent): boolean {
  const allowed = TRANSITIONS[currentStatus];
  return allowed?.[event] !== undefined;
}

/**
 * Get all valid events for a given status.
 */
export function validEventsFor(currentStatus: CaseStatus): TransitionEvent[] {
  const allowed = TRANSITIONS[currentStatus];
  return Object.keys(allowed ?? {}) as TransitionEvent[];
}
