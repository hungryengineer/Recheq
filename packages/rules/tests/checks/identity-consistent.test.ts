import { describe, it, expect } from 'vitest';
import { checkIdentityConsistent } from '../../src/checks/identity-consistent.js';
import type { CheckContext } from '../../src/check-context.js';

describe('checkIdentityConsistent', () => {
  it('returns not_assessed unless both documents exist', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: false },
      payslip: { pan: 'ABCPS1234F', employee_name: 'Priya Sharma' },
      form16: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkIdentityConsistent(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('not_assessed');
  });

  it('returns no findings when PANs and names match', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: true },
      payslip: { pan: 'ABCPS1234F', employee_name: 'Priya Sharma' },
      form16: { employee_pan: 'ABCPS1234F', employee_name: 'Priya Sharma' },
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkIdentityConsistent(ctx);
    expect(findings).toHaveLength(0);
  });

  it('flags a PAN mismatch across documents as high severity', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: true },
      payslip: { pan: 'ABCPS1234F', employee_name: 'Priya Sharma' },
      form16: { employee_pan: 'ZZZXX0000A', employee_name: 'Priya Sharma' },
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkIdentityConsistent(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule_id).toBe('identity-consistent-pan');
    expect(findings[0]?.severity).toBe('high');
  });

  it('flags a name mismatch across documents as medium severity', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: true },
      payslip: { pan: 'ABCPS1234F', employee_name: 'Priya Sharma' },
      form16: { employee_pan: 'ABCPS1234F', employee_name: 'Riya Sharma' },
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkIdentityConsistent(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule_id).toBe('identity-consistent-name');
    expect(findings[0]?.severity).toBe('medium');
  });

  it('skips PAN comparison when the payslip PAN is absent', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: true },
      payslip: { pan: null, employee_name: 'Priya Sharma' },
      form16: { employee_pan: 'ABCPS1234F', employee_name: 'Priya Sharma' },
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkIdentityConsistent(ctx);
    expect(findings).toHaveLength(0);
  });

  it('matches names case-insensitively and ignoring whitespace', () => {
    const ctx = {
      assembly: { has_payslip: true, has_form16: true },
      payslip: { pan: null, employee_name: 'Priya   Sharma' },
      form16: { employee_pan: null, employee_name: 'priya sharma' },
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkIdentityConsistent(ctx);
    expect(findings).toHaveLength(0);
  });
});
