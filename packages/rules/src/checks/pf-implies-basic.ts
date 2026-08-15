import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { PAYSLIP_ARITHMETIC_TOLERANCE } from '../constants.js';

/**
 * pf-implies-basic
 *
 * PF is deducted at 12% of basic salary (statutory rate).
 * So: implied_basic = pf_deduction / 0.12
 *
 * If implied_basic differs materially from the declared basic, the PF
 * deduction and the basic salary cannot both be correct — one was altered.
 *
 * Uses PAYSLIP_ARITHMETIC_TOLERANCE (Rs. 1) for floating-point safety.
 * Note: PF is capped at 12% of Rs. 15,000 = Rs. 1,800 when basic > Rs. 15,000.
 * We only flag when declared basic is below the cap threshold, or when
 * the implied basic is materially lower than declared basic (indicating inflation).
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

  const findings: FindingInput[] = [];

  // Implied basic from PF at statutory 12% rate
  const impliedBasic = p.pf_deduction / 0.12;

  // PF is capped at Rs. 1,800/month (12% of the Rs. 15,000 wage ceiling).
  // When pf_deduction === 1800 AND declared basic > 15,000 the rule cannot
  // distinguish a capped deduction from a tampered one — skip to avoid false positives.
  const PF_CAP = 1800;
  const WAGE_CEILING = 15000;
  if (p.pf_deduction === PF_CAP && p.basic.amount > WAGE_CEILING) {
    return [];
  }

  const diff = Math.abs(impliedBasic - p.basic.amount);

  if (diff > PAYSLIP_ARITHMETIC_TOLERANCE) {
    findings.push({
      rule_id: 'pf-implies-basic',
      severity: 'high',
      status: 'open',
      title: 'PF Deduction Inconsistent with Declared Basic',
      explanation: `PF employee share of Rs. ${p.pf_deduction.toLocaleString('en-IN')} implies a basic salary of Rs. ${Math.round(impliedBasic).toLocaleString('en-IN')} at the statutory 12% rate, but the declared basic is Rs. ${p.basic.amount.toLocaleString('en-IN')}.`,
      expected: `Rs. ${Math.round(impliedBasic).toLocaleString('en-IN')}`,
      observed: `Rs. ${p.basic.amount.toLocaleString('en-IN')}`,
      source_document_ids: [],
    });
  }

  return findings;
};
