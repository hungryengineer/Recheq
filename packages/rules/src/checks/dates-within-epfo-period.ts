
import type { RuleFunction } from '../check.js';

export const checkDatesWithinEpfoPeriod: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_epfo || !ctx.epfoHistory || !ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'dates-within-epfo-period',
        severity: 'medium',
        status: 'not_assessed',
        title: 'Dates Within EPFO Period Unverified',
        explanation: 'Requires EPFO history and Payslip data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }
  return []; // Stub implementation
};
