import { describe, it, expect } from 'vitest';
import { checkPayslipArithmetic } from '../../src/checks/payslip-arithmetic.js';
import type { CheckContext } from '../../src/check-context.js';

describe('checkPayslipArithmetic', () => {
  it('returns not_assessed if no payslip exists', () => {
    const ctx = {
      assembly: { has_payslip: false },
      payslip: null,
      form16: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkPayslipArithmetic(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('not_assessed');
  });

  it('returns no findings for correct arithmetic', () => {
    const ctx = {
      assembly: { has_payslip: true },
      payslip: {
        basic: { raw_label: 'Basic', amount: 10000 },
        hra: { raw_label: 'HRA', amount: 5000 },
        da: { raw_label: 'DA', amount: 0 },
        special_allowance: { raw_label: 'Special', amount: 0 },
        other_allowances: [],
        gross_salary: 15000,
        pf_deduction: 1200,
        professional_tax: 200,
        income_tax: 0,
        other_deductions: 0,
        total_deductions: 1400,
        net_salary: 13600,
      },
      form16: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkPayslipArithmetic(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns findings when arithmetic is incorrect', () => {
    const ctx = {
      assembly: { has_payslip: true },
      payslip: {
        basic: { raw_label: 'Basic', amount: 10000 },
        hra: { raw_label: 'HRA', amount: 5000 },
        da: { raw_label: 'DA', amount: 0 },
        special_allowance: { raw_label: 'Special', amount: 0 },
        other_allowances: [],
        gross_salary: 16000, // Should be 15000
        pf_deduction: 1200,
        professional_tax: 200,
        income_tax: 0,
        other_deductions: 0,
        total_deductions: 1400,
        net_salary: 13600, // 16000 - 1400 = 14600, so net is also wrong
      },
      form16: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkPayslipArithmetic(ctx);
    expect(findings).toHaveLength(2); // gross and net both fail
    expect(findings.some((f) => f.rule_id === 'payslip-arithmetic-gross')).toBe(true);
    expect(findings.some((f) => f.rule_id === 'payslip-arithmetic-net')).toBe(true);
  });
});
