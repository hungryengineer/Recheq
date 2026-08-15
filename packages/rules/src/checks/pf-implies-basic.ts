import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { PAYSLIP_ARITHMETIC_TOLERANCE } from '../constants.js';

/**
 * pf-implies-basic
 *
 * At the statutory 12% rate: expected_pf = basic * 0.12.
 * Compare pf_deduction to basic * 0.12 directly in contribution units (Rs.)
 * using PAYSLIP_ARITHMETIC_TOLERANCE. This avoids the division-by-0.12
 * amplification that would reject Rs. 0.24 rounding differences as high severity.
 *
 * PF cap: when pf_deduction === 1,800 AND basic > 15,000 the employer may have
 * applied the statutory wage ceiling (Rs. 15,000 × 12% = Rs. 1,800). The rule
 * cannot distinguish a capped deduction from a tampered one in that case — skip.
 */
export const checkPfImpliesBasic: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'pf-implies-basic',
        severity: 'high',
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

  if (p.basic.amount === null || p.pf_deduction === null || p.pf_deduction === 0) {
    return [];
  }

  const PF_CAP = 1800;
  const WAGE_CEILING = 15000;
  if (p.pf_deduction === PF_CAP && p.basic.amount > WAGE_CEILING) {
    return [];
  }

  const findings: FindingInput[] = [];
  const expectedPf = p.basic.amount * 0.12;
  const diff = Math.abs(p.pf_deduction - expectedPf);

  if (diff > PAYSLIP_ARITHMETIC_TOLERANCE) {
    const impliedBasic = Math.round(p.pf_deduction / 0.12);
    findings.push({
      rule_id: 'pf-implies-basic',
      severity: 'high',
      status: 'open',
      title: 'PF Deduction Inconsistent with Declared Basic',
      explanation: `PF employee share of Rs. ${p.pf_deduction.toLocaleString('en-IN')} implies a basic salary of Rs. ${impliedBasic.toLocaleString('en-IN')} at the statutory 12% rate, but the declared basic is Rs. ${p.basic.amount.toLocaleString('en-IN')}.`,
      expected: `Rs. ${impliedBasic.toLocaleString('en-IN')}`,
      observed: `Rs. ${p.basic.amount.toLocaleString('en-IN')}`,
      source_document_ids: [],
    });
  }

  return findings;
};
