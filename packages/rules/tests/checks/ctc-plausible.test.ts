import { describe, it, expect } from 'vitest';
import { checkCtcPlausible } from '../../src/checks/ctc-plausible.js';
import type { CheckContext } from '../../src/check-context.js';

describe('checkCtcPlausible', () => {
  it('returns not_assessed if no payslip exists', () => {
    const ctx = {
      assembly: { has_payslip: false } as any,
      payslip: null,
      form16: null,
      epfoHistory: null,
    } as CheckContext;

    const findings = checkCtcPlausible(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('not_assessed');
  });

  it('returns no findings if basic is within plausible range', () => {
    const ctx = {
      assembly: { has_payslip: true } as any,
      payslip: { basic: 50000, gross_salary: 100000 } as any, // 50%
      form16: null,
      epfoHistory: null,
    } as CheckContext;

    const findings = checkCtcPlausible(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns findings if basic is implausibly low', () => {
    const ctx = {
      assembly: { has_payslip: true } as any,
      payslip: { basic: 10000, gross_salary: 100000 } as any, // 10%
      form16: null,
      epfoHistory: null,
    } as CheckContext;

    const findings = checkCtcPlausible(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule_id).toBe('ctc-plausible');
  });
});
