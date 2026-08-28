import { describe, it, expect } from 'vitest';
import { checkCtcPlausible } from '../../src/checks/ctc-plausible.js';
import type { CheckContext } from '../../src/check-context.js';

describe('checkCtcPlausible', () => {
  it('returns not_assessed if no payslip exists', () => {
    const ctx = {
      assembly: { has_payslip: false },
      payslip: null,
      form16: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkCtcPlausible(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('not_assessed');
  });

  it('returns no findings if annualized gross matches claimed CTC within tolerance', () => {
    const ctx = {
      claimed_ctc: 1200000,
      assembly: { has_payslip: true },
      payslip: { gross_salary: 100000 }, // 100k * 12 = 1.2M
      form16: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkCtcPlausible(ctx);
    expect(findings).toHaveLength(0);
  });

  it('returns findings if annualized gross is implausible relative to claimed CTC', () => {
    const ctx = {
      claimed_ctc: 1200000,
      assembly: { has_payslip: true },
      payslip: { gross_salary: 50000 }, // 50k * 12 = 600k
      form16: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkCtcPlausible(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule_id).toBe('ctc-plausible');
    expect(findings[0]?.status).toBe('open');
  });
});
