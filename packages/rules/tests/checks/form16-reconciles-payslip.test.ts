import { describe, it, expect } from 'vitest';
import { checkForm16ReconcilesPayslip } from '../../src/checks/form16-reconciles-payslip.js';
import type { CheckContext } from '../../src/check-context.js';

describe('checkForm16ReconcilesPayslip', () => {
  it('returns not_assessed if inputs are missing', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: false } as any,
      payslip: { gross_salary: 50000 } as any,
      form16: null,
      epfoHistory: null,
    } as CheckContext;

    const findings = checkForm16ReconcilesPayslip(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('not_assessed');
  });

  it('returns no findings if annualized gross matches form16 within tolerance', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: true } as any,
      payslip: { gross_salary: 50000 } as any, // annualized = 600000
      form16: { gross_total_income: 600100 } as any, // diff 100 <= 500
      epfoHistory: null,
    } as CheckContext;

    const findings = checkForm16ReconcilesPayslip(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns finding if mismatch is outside tolerance', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: true } as any,
      payslip: { gross_salary: 50000 } as any, // annualized = 600000
      form16: { gross_total_income: 700000 } as any, // diff 100000 > 500
      epfoHistory: null,
    } as CheckContext;

    const findings = checkForm16ReconcilesPayslip(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule_id).toBe('form16-reconciles-payslip');
  });
});
