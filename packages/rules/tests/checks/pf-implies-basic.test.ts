import { describe, it, expect } from 'vitest';
import { checkPfImpliesBasic } from '../../src/checks/pf-implies-basic.js';
import type { CheckContext } from '../../src/check-context.js';

describe('checkPfImpliesBasic', () => {
  it('returns not_assessed if no payslip exists', () => {
    const ctx = {
      assembly: { has_payslip: false } as any,
      payslip: null,
      form16: null,
      epfoHistory: null,
    } as CheckContext;

    const findings = checkPfImpliesBasic(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('not_assessed');
  });

  it('returns no findings when PF is exactly 12% of basic', () => {
    const ctx = {
      assembly: { has_payslip: true } as any,
      payslip: { basic: 10000, pf_deduction: 1200 } as any,
      form16: null,
      epfoHistory: null,
    } as CheckContext;

    const findings = checkPfImpliesBasic(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns finding when PF is wildly off 12%', () => {
    const ctx = {
      assembly: { has_payslip: true } as any,
      payslip: { basic: 10000, pf_deduction: 2000 } as any, // 20%
      form16: null,
      epfoHistory: null,
    } as CheckContext;

    const findings = checkPfImpliesBasic(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule_id).toBe('pf-implies-basic');
  });
});
