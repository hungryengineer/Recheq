import type { FindingInput } from '@tieout/schema';
import type { CheckContext } from './check-context.js';

// ─── Rule Function Signature ────────────────────────────────────
/**
 * A pure deterministic function that evaluates assembled evidence
 * and returns zero or more findings.
 */
export type RuleFunction = (ctx: CheckContext) => FindingInput[];
