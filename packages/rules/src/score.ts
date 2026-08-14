import type { FindingSeverity, FindingStatus } from '@tieout/schema';
import { HIGH_WEIGHT, MEDIUM_WEIGHT, LOW_WEIGHT, MAX_SCORE } from './constants.js';

/**
 * Minimal finding shape needed for score calculation.
 * Only open findings contribute to the risk score.
 */
export interface ScorableFinding {
  severity: FindingSeverity;
  status: FindingStatus;
}

/**
 * Count open findings by severity.
 */
function countOpenBySeverity(findings: readonly ScorableFinding[]): {
  high: number;
  medium: number;
  low: number;
} {
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const f of findings) {
    if (f.status !== 'open') continue;
    switch (f.severity) {
      case 'high':
        high++;
        break;
      case 'medium':
        medium++;
        break;
      case 'low':
        low++;
        break;
    }
  }

  return { high, medium, low };
}

/**
 * Calculate the risk score from findings.
 *
 * Formula: min(100, 40 × high + 15 × medium + 5 × low)
 *
 * Only **open** findings are counted. Disputed, resolved, and
 * not_assessed findings do not contribute to the score.
 */
export function calculateRiskScore(findings: readonly ScorableFinding[]): number {
  const counts = countOpenBySeverity(findings);
  const raw =
    counts.high * HIGH_WEIGHT +
    counts.medium * MEDIUM_WEIGHT +
    counts.low * LOW_WEIGHT;

  return Math.min(MAX_SCORE, raw);
}

/**
 * Returns the breakdown of open findings by severity.
 * Useful for score display / explanation.
 */
export function getScoreBreakdown(findings: readonly ScorableFinding[]): {
  high: number;
  medium: number;
  low: number;
  raw: number;
  capped: number;
} {
  const counts = countOpenBySeverity(findings);
  const raw =
    counts.high * HIGH_WEIGHT +
    counts.medium * MEDIUM_WEIGHT +
    counts.low * LOW_WEIGHT;

  return {
    ...counts,
    raw,
    capped: Math.min(MAX_SCORE, raw),
  };
}
