import { describe, it, expect } from 'vitest';
import { checkForm16IdentifierFormat } from '../../src/checks/form16-identifier-format.js';
import type { CheckContext } from '../../src/check-context.js';

describe('checkForm16IdentifierFormat', () => {
  it('returns not_assessed if no form16 exists', () => {
    const ctx = {
      assembly: { has_form16: false },
      form16: null,
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16IdentifierFormat(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.status).toBe('not_assessed');
  });

  it('returns no findings for valid PAN and TAN formats', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        employee_pan: 'ABCPS1234F',
        employer_tan: 'MUMC12345B',
        employer_pan: 'AAACT1234C',
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16IdentifierFormat(ctx);
    expect(findings).toHaveLength(0);
  });

  it('flags an invalid employee PAN', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        employee_pan: '1234X',
        employer_tan: 'MUMC12345B',
        employer_pan: 'AAACT1234C',
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16IdentifierFormat(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule_id).toBe('form16-identifier-format');
    expect(findings[0]?.severity).toBe('high');
  });

  it('flags an invalid employer TAN', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        employee_pan: 'ABCPS1234F',
        employer_tan: 'TAN-123',
        employer_pan: 'AAACT1234C',
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16IdentifierFormat(ctx);
    expect(findings).toHaveLength(1);
    expect(findings.some((f) => f.title === 'Employer TAN Format Invalid')).toBe(true);
  });

  it('ignores null identifiers', () => {
    const ctx = {
      assembly: { has_form16: true },
      form16: {
        employee_pan: null,
        employer_tan: null,
        employer_pan: null,
      },
      payslip: null,
      epfoHistory: null,
    } as unknown as CheckContext;

    const findings = checkForm16IdentifierFormat(ctx);
    expect(findings).toHaveLength(0);
  });
});
