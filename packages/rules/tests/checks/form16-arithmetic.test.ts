import { describe, it, expect } from 'vitest';
import { checkForm16Arithmetic } from '../../src/checks/form16-arithmetic.js';
import type { CheckContext } from '../../src/check-context.js';

describe('checkForm16Arithmetic', () => {
  it('returns not_assessed if no form16 exists', () => {
    const ctx = {
      assembly: { has_form16: false },
      form16: null,
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16Arithmetic(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('not_assessed');
  });

  it('returns no findings for correct Part B arithmetic', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        gross_total_income: 547200,
        exempt_allowances: 38400,
        standard_deduction: 50000,
        professional_tax: 2400,
        net_taxable_salary: 456400,
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16Arithmetic(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns no findings when the mismatch is at the 50 INR tolerance boundary', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        gross_total_income: 547200,
        exempt_allowances: 38400,
        standard_deduction: 50000,
        professional_tax: 2400,
        net_taxable_salary: 456450, // diff exactly 50
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16Arithmetic(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns a high finding when the mismatch exceeds the 50 INR tolerance', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        gross_total_income: 547200,
        exempt_allowances: 38400,
        standard_deduction: 50000,
        professional_tax: 2400,
        net_taxable_salary: 456451, // diff exactly 51
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16Arithmetic(ctx);
    expect(findings).toHaveLength(1);
  });

  it('returns a high finding when net taxable salary is inconsistent', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        gross_total_income: 547200,
        exempt_allowances: 38400,
        standard_deduction: 50000,
        professional_tax: 2400,
        net_taxable_salary: 400000, // 547200-38400-50000-2400 = 456400
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16Arithmetic(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule_id).toBe('form16-arithmetic');
    expect(findings[0]?.severity).toBe('high');
    expect(findings[0]?.status).toBe('open');
  });

  it('returns no findings when required numbers are missing', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        gross_total_income: null,
        exempt_allowances: null,
        standard_deduction: null,
        professional_tax: null,
        net_taxable_salary: null,
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16Arithmetic(ctx);
    expect(findings).toHaveLength(0);
  });
});
