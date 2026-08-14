// ─── Frozen Tolerances & Score Weights ──────────────────────────
// These values are frozen by the build specification.
// Do NOT modify without a team-wide contract change.

/** Weight for high-severity findings in risk score */
export const HIGH_WEIGHT = 40;

/** Weight for medium-severity findings in risk score */
export const MEDIUM_WEIGHT = 15;

/** Weight for low-severity findings in risk score */
export const LOW_WEIGHT = 5;

/** Maximum risk score (score is capped at this value) */
export const MAX_SCORE = 100;

// ─── Tolerance Constants ────────────────────────────────────────
// Used by individual rule checks for numeric comparisons.

/** Payslip arithmetic tolerance (absolute, INR) */
export const PAYSLIP_ARITHMETIC_TOLERANCE = 1;

/** PF rate tolerance (percentage points) */
export const PF_RATE_TOLERANCE = 0.01;

/** CTC plausibility tolerance (percentage) */
export const CTC_PLAUSIBILITY_TOLERANCE = 0.1;

/** Form 16 vs payslip reconciliation tolerance (absolute, INR) */
export const FORM16_RECONCILIATION_TOLERANCE = 500;
