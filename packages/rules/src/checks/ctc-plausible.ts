import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { CTC_PLAUSIBILITY_TOLERANCE } from '../constants.js';

export const checkCtcPlausible: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'ctc-plausible',
        severity: 'medium',
        status: 'not_assessed',
        title: 'CTC Plausibility Unverified',
        explanation: 'Payslip extraction data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const p = ctx.payslip;

  if (p.gross_salary === null) {
    return [];
  }

  // Exact Plausibility Check: Compare claimed CTC against the extracted gross salary.
  // We assume monthly gross salary * 12 should be close to claimed CTC (within 10% tolerance).
  const claimedCtc = ctx.claimed_ctc;
  const annualizedGross = p.gross_salary * 12;

  const findings: FindingInput[] = [];

  const ratio = annualizedGross / claimedCtc;
  if (ratio < 1 - CTC_PLAUSIBILITY_TOLERANCE || ratio > 1 + CTC_PLAUSIBILITY_TOLERANCE) {
    findings.push({
      rule_id: 'ctc-plausible',
      severity: 'high',
      status: 'open',
      title: 'CTC Mismatch',
      explanation: `Annualized gross salary from payslip does not match the candidate's claimed CTC.`,
      expected: `~ ₹${claimedCtc.toLocaleString()}`,
      observed: `₹${annualizedGross.toLocaleString()}`,
      source_document_ids: [],
    });
  }

  return findings;
};
