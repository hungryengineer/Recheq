import type { FindingInput } from '@tieout/schema';
import type { RuleFunction } from '../check.js';
import { PAYSLIP_ARITHMETIC_TOLERANCE } from '../constants.js';

export const checkPayslipArithmetic: RuleFunction = (ctx) => {
  if (!ctx.assembly.has_payslip || !ctx.payslip) {
    return [
      {
        rule_id: 'payslip-arithmetic',
        severity: 'high',
        status: 'not_assessed',
        title: 'Payslip Arithmetic Unverified',
        explanation: 'Payslip extraction data is missing.',
        expected: null,
        observed: null,
        source_document_ids: [],
      },
    ];
  }

  const p = ctx.payslip;
  const findings: FindingInput[] = [];

  // Safe summation treating null as 0
  const sum = (...vals: (number | null)[]) => vals.reduce<number>((a, b) => a + (b ?? 0), 0);

  // 1. Gross Salary check
  const calculatedGross = sum(
    p.basic.amount,
    p.hra.amount,
    p.da.amount,
    p.special_allowance.amount,
    ...p.other_allowances.map((a) => a.amount),
  );
  if (p.gross_salary !== null) {
    const diff = Math.abs(calculatedGross - p.gross_salary);
    if (diff > PAYSLIP_ARITHMETIC_TOLERANCE) {
      findings.push({
        rule_id: 'payslip-arithmetic-gross',
        severity: 'high',
        status: 'open',
        title: 'Gross Salary Mismatch',
        explanation: 'The sum of all allowances does not equal the stated gross salary.',
        expected: String(calculatedGross),
        observed: String(p.gross_salary),
        source_document_ids: [], // We don't have doc ID mapped in context directly yet, normally it would be passed or we leave empty
      });
    }
  }

  // 2. Net Salary check
  if (p.gross_salary !== null && p.total_deductions !== null && p.net_salary !== null) {
    const calculatedNet = p.gross_salary - p.total_deductions;
    const diff = Math.abs(calculatedNet - p.net_salary);
    if (diff > PAYSLIP_ARITHMETIC_TOLERANCE) {
      findings.push({
        rule_id: 'payslip-arithmetic-net',
        severity: 'high',
        status: 'open',
        title: 'Net Salary Mismatch',
        explanation: 'Gross salary minus deductions does not equal stated net salary.',
        expected: String(calculatedNet),
        observed: String(p.net_salary),
        source_document_ids: [],
      });
    }
  }

  return findings;
};
