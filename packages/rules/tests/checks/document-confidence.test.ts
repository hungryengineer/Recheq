import { describe, it, expect } from 'vitest';
import type { CheckContext } from '../../src/check-context.js';
import { calculatePayslipConfidence, calculateForm16Confidence } from '../../src/confidence.js';
import { checkDocumentConfidence } from '../../src/checks/document-confidence.js';
import type { Form16Extraction, PayslipExtraction } from '@recheq/schema';
import type { ForensicsData } from '../../src/check-context.js';

function payslip(partial: Partial<PayslipExtraction>): PayslipExtraction {
  return {
    employer_name: 'Acme Corp',
    employee_name: 'Test User',
    pan: 'ABCPS1234F',
    uan: 'UAN12345',
    gross_salary: 50000,
    net_salary: 41400,
    total_deductions: 8600,
    ...partial,
  } as unknown as PayslipExtraction;
}

function form16(partial: Partial<Form16Extraction>): Form16Extraction {
  return {
    employer_name: 'Acme Corp',
    employee_name: 'Test User',
    employee_pan: 'ABCPS1234F',
    employer_tan: 'DELA12345A',
    employer_pan: 'AACC0112K',
    financial_year: '2026-2027',
    assessment_year: '2027-2028',
    gross_total_income: 600000,
    exempt_allowances: 50000,
    standard_deduction: 75000,
    professional_tax: 2400,
    net_taxable_salary: 472600,
    total_tax_deducted: 31000,
    total_tax_deposited: 31000,
    total_income_tax_payable: 31000,
    ...partial,
  } as unknown as Form16Extraction;
}

function ctxWith(args: Partial<CheckContext>): CheckContext {
  return {
    assembly: {
      case_id: 'c1',
      origins: ['payslip'],
      has_payslip: false,
      has_form16: false,
      has_epfo: false,
      has_employer: false,
      has_forensics: false,
    },
    claimed_ctc: 600000,
    payslip: null,
    form16: null,
    epfoHistory: null,
    forensics: null,
    ...args,
  } as CheckContext;
}

describe('calculatePayslipConfidence', () => {
  it('scores 0 with a penalty when the payslip is missing', () => {
    const { score, penalties } = calculatePayslipConfidence(ctxWith({}));
    expect(score).toBe(0);
    expect(penalties).toContain('Payslip extraction missing');
  });

  it('scores 100 for a complete payslip', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_payslip: true },
      payslip: payslip({}),
    });
    const { score, penalties } = calculatePayslipConfidence(ctx);
    expect(score).toBe(100);
    expect(penalties).toHaveLength(0);
  });

  it('penalizes each missing field', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_payslip: true },
      payslip: payslip({ pan: null, uan: null, employer_name: null, gross_salary: null }),
    });
    const { score, penalties } = calculatePayslipConfidence(ctx);
    expect(score).toBe(60);
    expect(penalties).toEqual(
      expect.arrayContaining([
        'Missing PAN',
        'Missing UAN',
        'Missing Employer Name',
        'Missing Gross Salary',
      ]),
    );
  });

  it('penalizes internal math mismatch', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_payslip: true },
      payslip: payslip({ gross_salary: 50000, total_deductions: 8600, net_salary: 90000 }),
    });
    const { score } = calculatePayslipConfidence(ctx);
    expect(score).toBe(70);
  });

  it('penalizes forensics anomalies', () => {
    const forensics = [
      {
        font_runs: { anomalous_characters: 3 },
        monetary_anomalies: { flagged_regions: 1 },
      },
    ] as unknown as ForensicsData[];
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_payslip: true, has_forensics: true },
      payslip: payslip({}),
      forensics,
    });
    const { score } = calculatePayslipConfidence(ctx);
    expect(score).toBe(20);
  });

  it('treats non-finite amounts as missing instead of crashing', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_payslip: true },
      payslip: payslip({ net_salary: NaN as unknown as number }),
    });
    const { score, penalties } = calculatePayslipConfidence(ctx);
    expect(score).toBe(90);
    expect(penalties).toContain('Missing Net Salary');
  });

  it('penalizes negative amounts as implausible', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_payslip: true },
      payslip: payslip({ gross_salary: -50000 as unknown as number }),
    });
    const { score, penalties } = calculatePayslipConfidence(ctx);
    expect(score).toBe(90);
    expect(penalties).toContain('Gross salary is negative');
  });
});

describe('calculateForm16Confidence', () => {
  it('scores 0 when the form16 is missing', () => {
    const { score } = calculateForm16Confidence(ctxWith({}));
    expect(score).toBe(0);
  });

  it('scores 100 for a complete form16', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_form16: true },
      form16: form16({}),
    });
    expect(calculateForm16Confidence(ctx)).toEqual({ score: 100, penalties: [] });
  });

  it('matches the Shankar case: PAN present, rest missing -> 60', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_form16: true },
      form16: form16({
        employee_pan: 'BMEPA3705K',
        employer_name: null,
        gross_total_income: null,
        net_taxable_salary: null,
        exempt_allowances: null,
        standard_deduction: null,
        professional_tax: null,
      }),
    });
    const { score, penalties } = calculateForm16Confidence(ctx);
    expect(score).toBe(60);
    expect(penalties).toEqual(
      expect.arrayContaining([
        'Missing Employer Name',
        'Missing Gross Income',
        'Missing Net Taxable Salary',
      ]),
    );
  });

  it('penalizes internal math mismatch', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_form16: true },
      form16: form16({ net_taxable_salary: 100000 }),
    });
    const { score } = calculateForm16Confidence(ctx);
    expect(score).toBe(70);
  });

  it('scores 50 when every scored field is missing', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_form16: true },
      form16: form16({
        employee_pan: null,
        employer_name: null,
        employer_tan: null,
        gross_total_income: null,
        exempt_allowances: null,
        standard_deduction: null,
        professional_tax: null,
        net_taxable_salary: null,
      }),
    });
    const { score } = calculateForm16Confidence(ctx);
    expect(score).toBe(50);
  });

  it('treats non-finite gross income as missing without crashing', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_form16: true },
      form16: form16({ gross_total_income: Infinity as unknown as number }),
    });
    const { score, penalties } = calculateForm16Confidence(ctx);
    expect(score).toBe(80);
    expect(penalties).toContain('Missing Gross Income');
  });

  it('penalizes a negative net taxable salary as implausible', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_form16: true },
      form16: form16({ net_taxable_salary: -10000 as unknown as number }),
    });
    const { score, penalties } = calculateForm16Confidence(ctx);
    expect(score).toBe(90);
    expect(penalties).toContain('Net taxable salary is negative');
  });
});

describe('checkDocumentConfidence rule', () => {
  it('flags a 60% form16 as a medium open finding', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_form16: true },
      form16: form16({ employer_name: null, gross_total_income: null, net_taxable_salary: null }),
    });
    const findings = checkDocumentConfidence(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule_id: 'document-confidence',
      severity: 'medium',
      status: 'open',
      expected: 'Confidence >= 90%',
      observed: '60%',
    });
  });

  it('escalates below-60% confidence to high severity', () => {
    const ctx = ctxWith({
      assembly: { ...ctxWith({}).assembly, has_form16: true },
      form16: form16({
        employee_pan: null,
        employer_name: null,
        employer_tan: null,
        financial_year: null,
        gross_total_income: null,
        net_taxable_salary: null,
      }),
    });
    const findings = checkDocumentConfidence(ctx);
    expect(findings[0]?.severity).toBe('high');
  });

  it('returns not_assessed when no payslip or form16 exists', () => {
    const findings = checkDocumentConfidence(ctxWith({}));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ status: 'not_assessed', rule_id: 'document-confidence' });
  });
});
