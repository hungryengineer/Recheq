import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { PF_RATE_TOLERANCE } from '../constants.js';

export const checkPfImpliesBasic: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'pf-implies-basic',
        severity: 'medium',
        status: 'not_assessed',
        title: 'PF Basic Implication Unverified',
        explanation: 'Payslip extraction data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const p = ctx.payslip;

  if (p.basic.amount === null || p.pf_deduction === null || p.basic.amount === 0) {
    return [];
  }

  const findings: FindingInput[] = [];
  const calculatedPfRate = p.pf_deduction / p.basic.amount;

  if (Math.abs(calculatedPfRate - 0.12) > PF_RATE_TOLERANCE) {
    findings.push({
      rule_id: 'pf-implies-basic',
      severity: 'medium',
      status: 'open',
      title: 'Anomalous PF Deduction Rate',
      explanation: 'PF deduction is not the standard 12% of basic salary.',
      expected: '12%',
      observed: `${(calculatedPfRate * 100).toFixed(2)}%`,
      source_document_ids: [],
    });
  }

  return findings;
};
