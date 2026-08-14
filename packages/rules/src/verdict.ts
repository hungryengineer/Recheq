import type { Verdict, FindingSeverity, FindingStatus } from '@tieout/schema';

/**
 * Minimal finding shape needed for verdict calculation.
 */
export interface VerdictableFinding {
  severity: FindingSeverity;
  status: FindingStatus;
}

/**
 * Calculate the verdict from findings and evidence origin count.
 *
 * Decision tree (using only open findings):
 *   1. If evidenceOriginCount <= 1 → `insufficient_evidence`
 *   2. If any open high-severity finding → `needs_review`
 *   3. If any open medium-severity finding (no high) → `verified_with_notes`
 *   4. Otherwise → `verified`
 *
 * This function NEVER returns `rejected`. That verdict does not exist
 * in the frozen contract.
 */
export function calculateVerdict(
  findings: readonly VerdictableFinding[],
  evidenceOriginCount: number,
): Verdict {
  // Rule 1: insufficient independent sources
  if (evidenceOriginCount <= 1) {
    return 'insufficient_evidence';
  }

  // Filter to only open findings
  const openFindings = findings.filter((f) => f.status === 'open');

  // Rule 2: any open high → needs_review
  const hasHighOpen = openFindings.some((f) => f.severity === 'high');
  if (hasHighOpen) {
    return 'needs_review';
  }

  // Rule 3: medium without high → verified_with_notes
  const hasMediumOpen = openFindings.some((f) => f.severity === 'medium');
  if (hasMediumOpen) {
    return 'verified_with_notes';
  }

  // Rule 4: clean — only low or no findings
  return 'verified';
}
