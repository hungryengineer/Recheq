import type { RuleFunction } from '../check.js';

export const checkEpfoGapAnalysis: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_epfo || !ctx.epfoHistory) {
    return [
      {
        rule_id: 'epfo-gap-analysis',
        severity: 'medium',
        status: 'not_assessed',
        title: 'EPFO Gap Analysis Unverified',
        explanation: 'Requires EPFO history data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }
  return []; // Stub implementation
};
