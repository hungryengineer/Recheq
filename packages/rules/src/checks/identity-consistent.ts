import type { FindingInput } from '@recheq/schema';
import type { RuleFunction } from '../check.js';

function normalizeName(name: string | null): string {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, '').trim();
}

/**
 * Cross-document identity consistency between the payslip and the Form 16:
 * the employee PAN must match when both documents print one, and the employee
 * names must match wherever they are present.
 */
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

  const p = ctx.payslip;
  const f = ctx.form16;
  const findings: FindingInput[] = [];

  if (p.pan && f.employee_pan && p.pan.toUpperCase() !== f.employee_pan.toUpperCase()) {
    findings.push({
      rule_id: 'identity-consistent-pan',
      severity: 'high',
      status: 'open',
      title: 'PAN Mismatch Across Documents',
      explanation:
        'The PAN printed on the payslip differs from the employee PAN printed on the Form 16.',
      expected: p.pan,
      observed: f.employee_pan,
      source_document_ids: [],
    });
  }

  const payslipName = normalizeName(p.employee_name);
  const form16Name = normalizeName(f.employee_name);
  if (payslipName && form16Name && payslipName !== form16Name) {
    findings.push({
      rule_id: 'identity-consistent-name',
      severity: 'medium',
      status: 'open',
      title: 'Employee Name Mismatch',
      explanation: 'The employee name printed on the payslip differs from the name on the Form 16.',
      expected: p.employee_name,
      observed: f.employee_name,
      source_document_ids: [],
    });
  }

  return findings;
};
