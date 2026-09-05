import type { FindingInput } from '@recheq/schema';
import type { CheckContext } from './check-context.js';
import { RULE_REGISTRY } from './registry.js';

/**
 * Runs all active deterministic rules against the provided CheckContext.
 * Flattens all returned FindingInputs into a single array.
 */
export function runAllChecks(ctx: CheckContext): FindingInput[] {
  const allFindings: FindingInput[] = [];

  for (const [ruleId, ruleFn] of Object.entries(RULE_REGISTRY)) {
    try {
      const findings = ruleFn(ctx);
      allFindings.push(...findings);
    } catch (err) {
      // If a rule crashes unexpectedly, we emit a high-severity finding
      // so it isn't swallowed silently.
      const msg = err instanceof Error ? err.message : String(err);
      allFindings.push({
        rule_id: ruleId,
        severity: 'high',
        status: 'open',
        title: 'Rule Evaluation Crash',
        explanation: `The rule logic encountered an unexpected crash: ${msg}`,
        expected: null,
        observed: null,
        source_document_ids: [],
      });
    }
  }

  return allFindings;
}
