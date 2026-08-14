import type { RuleFunction } from '../check.js';

export const checkEmployerNameMatch: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'employer-name-match',
        severity: 'medium',
        status: 'not_assessed',
        title: 'Employer Name Match Unverified',
        explanation: 'Requires Payslip extraction data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }
  return []; // Stub implementation
};
