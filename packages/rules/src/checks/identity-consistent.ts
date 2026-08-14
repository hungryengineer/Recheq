
import type { RuleFunction } from '../check.js';

export const checkIdentityConsistent: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_payslip || !ctx.payslip || !ctx.assembly.has_form16 || !ctx.form16) {
    return [
      {
        rule_id: 'identity-consistent',
        severity: 'high',
        status: 'not_assessed',
        title: 'Identity Consistency Unverified',
        explanation: 'Requires both Payslip and Form 16 to compare identities.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }
  return []; // Stub implementation
};
