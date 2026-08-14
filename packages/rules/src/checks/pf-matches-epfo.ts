import type { RuleFunction } from '../check.js';

export const checkPfMatchesEpfo: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_epfo || !ctx.epfoHistory || !ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'pf-matches-epfo',
        severity: 'high',
        status: 'not_assessed',
        title: 'PF/EPFO Match Unverified',
        explanation: 'Requires both EPFO history and Payslip extraction data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }
  return []; // Stub implementation
};
