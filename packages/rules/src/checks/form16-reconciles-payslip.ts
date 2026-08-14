import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { FORM16_RECONCILIATION_TOLERANCE } from '../constants.js';

export const checkForm16ReconcilesPayslip: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_payslip || !ctx.payslip || !ctx.assembly.has_form16 || !ctx.form16) {
    return [
      {
        rule_id: 'form16-reconciles-payslip',
        severity: 'high',
        status: 'not_assessed',
        title: 'Form 16 / Payslip Reconciliation Unverified',
        explanation: 'Requires both Payslip and Form 16 extraction data.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const p = ctx.payslip;
  const f = ctx.form16;

  if (p.gross_salary === null || f.gross_total_income === null) {
    return [];
  }

  const findings: FindingInput[] = [];
  const annualizedGross = p.gross_salary * 12;

  const diff = Math.abs(annualizedGross - f.gross_total_income);

  if (diff > FORM16_RECONCILIATION_TOLERANCE) {
    findings.push({
      rule_id: 'form16-reconciles-payslip',
      severity: 'high',
      status: 'open',
      title: 'Income Reconciliation Failure',
      explanation: 'Annualized payslip gross salary does not match Form 16 gross total income.',
      expected: String(annualizedGross),
      observed: String(f.gross_total_income),
      source_document_ids: [],
    });
  }

  return findings;
};
