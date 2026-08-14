// ─── @tieout/rules ──────────────────────────────────────────────
// Barrel re-export of all rules, calculators, and state machine.

export {
  HIGH_WEIGHT,
  MEDIUM_WEIGHT,
  LOW_WEIGHT,
  MAX_SCORE,
  PAYSLIP_ARITHMETIC_TOLERANCE,
  PF_RATE_TOLERANCE,
  CTC_PLAUSIBILITY_TOLERANCE,
  FORM16_RECONCILIATION_TOLERANCE,
} from './constants.js';

export {
  calculateRiskScore,
  getScoreBreakdown,
  type ScorableFinding,
} from './score.js';

export {
  calculateVerdict,
  type VerdictableFinding,
} from './verdict.js';

export {
  transition,
  canTransition,
  validEventsFor,
  type TransitionEvent,
  type TransitionResult,
  type InvalidTransitionError,
} from './status-machine.js';
