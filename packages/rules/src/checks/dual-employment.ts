import type { RuleFunction } from '../check.js';

export const checkDualEmployment: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_epfo || !ctx.epfoHistory) {
    return [
      {
        rule_id: 'dual-employment',
        severity: 'high',
        status: 'not_assessed',
        title: 'Dual Employment Unverified',
        explanation: 'Requires EPFO history data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }
  return []; // Stub implementation
};
