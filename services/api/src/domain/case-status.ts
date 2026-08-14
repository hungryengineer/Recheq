import type { CaseStatus } from '@tieout/schema';
import { transition, type TransitionEvent, type TransitionResult } from '@tieout/rules';

/**
 * Transition a case's status through the state machine.
 *
 * This is the ONLY way routes and services should change a case's status.
 * Direct assignment to `cases.status` is prohibited — it bypasses
 * validation and auditability.
 *
 * @param currentStatus - The case's current status
 * @param event - The event triggering the transition
 * @returns The new status on success
 * @throws Error with code INVALID_TRANSITION on failure
 */
export function transitionCaseStatus(
  currentStatus: CaseStatus,
  event: TransitionEvent,
): CaseStatus {
  const result: TransitionResult = transition(currentStatus, event);

  if (!result.ok) {
    const err = new Error(result.error.message) as Error & {
      code: string;
      from: CaseStatus;
      event: TransitionEvent;
    };
    err.code = result.error.code;
    err.from = result.error.from;
    err.event = result.error.event;
    throw err;
  }

  return result.status;
}
