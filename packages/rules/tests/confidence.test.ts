import { describe, it, expect } from 'vitest';
import { calculatePayslipConfidence, calculateForm16Confidence } from '../src/confidence.js';
import { checkDocumentConfidence } from '../src/checks/document-confidence.js';
import type { CheckContext } from '../src/check-context.js';

describe('Document-Level Confidence Scoring', () => {
  describe('Payslip Confidence', () => {
    it('returns 0 if payslip is missing', () => {
      const ctx = { payslip: null } as CheckContext;
      const result = calculatePayslipConfidence(ctx);
      expect(result.score).toBe(0);
      expect(result.penalties).toContain('Payslip extraction missing');
    });

    it('returns 100 for a perfectly complete payslip with math matching', () => {
      const ctx = {
        payslip: {
          pan: 'ABCDE1234F',
          uan: '100000000000',
          employer_name: 'Tech Corp',
          gross_salary: 100000,
          total_deductions: 10000,
          net_salary: 90000,
        },
        forensics: [],
      } as unknown as CheckContext;
      const result = calculatePayslipConfidence(ctx);
      expect(result.score).toBe(100);
      expect(result.penalties).toHaveLength(0);
    });

    it('deducts points for missing fields', () => {
      const ctx = {
        payslip: {
          pan: null,
          uan: null,
          employer_name: null,
          gross_salary: null,
          net_salary: null,
        },
        forensics: [],
      } as unknown as CheckContext;
      const result = calculatePayslipConfidence(ctx);
      expect(result.score).toBe(50); // 100 - 10(pan) - 10(uan) - 10(employer) - 10(gross) - 10(net) = 50
    });

    it('deducts points for math mismatch', () => {
      const ctx = {
        payslip: {
          pan: 'ABCDE1234F',
          uan: '100000000000',
          employer_name: 'Tech Corp',
          gross_salary: 100000,
          total_deductions: 10000,
          net_salary: 80000, // Should be 90000
        },
        forensics: [],
      } as unknown as CheckContext;
      const result = calculatePayslipConfidence(ctx);
      expect(result.score).toBe(70);
      expect(result.penalties).toContain('Internal math mismatch (Gross - Deductions != Net)');
    });
  });

  describe('Form 16 Confidence', () => {
    it('returns 100 for a perfect form 16', () => {
      const ctx = {
        form16: {
          employee_pan: 'ABCDE1234F',
          employer_name: 'Tech Corp',
          gross_total_income: 1000000,
          exempt_allowances: 50000,
          standard_deduction: 50000,
          professional_tax: 2500,
          net_taxable_salary: 897500,
        },
        forensics: [],
      } as unknown as CheckContext;
      const result = calculateForm16Confidence(ctx);
      expect(result.score).toBe(100);
      expect(result.penalties).toHaveLength(0);
    });
  });
});

// ─── End-to-end LLM confidence goal ─────────────────────────────
// The LLM path must yield a SATISFACTORY confidence score: HIGH (>= 90, no
// finding) for a good document, and LOW (< 90, a confidence finding fires) for
// a bad/doctored document. These mirror the schema-valid extractions the fixed
// prompts now produce.
function payslipAssembly(forensicsCount = 0) {
  return {
    case_id: '00000000-0000-0000-0000-000000000001',
    origins: ['payslip'] as const,
    has_payslip: true,
    has_form16: false,
    has_epfo: false,
    has_employer: false,
    has_forensics: forensicsCount > 0,
  };
}

function form16Assembly(forensicsCount = 0) {
  return {
    case_id: '00000000-0000-0000-0000-000000000001',
    origins: ['form_16'] as const,
    has_payslip: false,
    has_form16: true,
    has_epfo: false,
    has_employer: false,
    has_forensics: forensicsCount > 0,
  };
}

const goodPayslip = {
  employee_name: 'Priya Sharma',
  employee_id: 'EMP-1042',
  employer_name: 'Tech Corp India Pvt Ltd',
  month: 'January',
  year: 2024,
  basic: { raw_label: 'Basic Salary', amount: 55000 },
  hra: { raw_label: 'HRA', amount: 22000 },
  da: { raw_label: 'DA', amount: 5500 },
  special_allowance: { raw_label: 'Special', amount: 12000 },
  other_allowances: [{ raw_label: 'Transport', amount: 3200 }],
  gross_salary: 97700,
  pf_deduction: 6600,
  professional_tax: 200,
  income_tax: 8500,
  other_deductions: 0,
  total_deductions: 15300,
  net_salary: 82400,
  uan: '100000000042',
  pf_account_number: 'MH/BAN/12345/000/1042',
  pan: null, // Indian payslips legitimately omit PAN
  extraction_notes: null,
  schema_version: 'payslip-v1' as const,
};

const doctoredPayslip = {
  ...goodPayslip,
  // Amount tampering: basic was doctored while PF stayed put -> math no longer
  // balances AND forensics flags the font runs in the monetary region.
  gross_salary: 120000,
  net_salary: 100000,
  total_deductions: 15300,
};

describe('Good vs bad document confidence (LLM end-to-end goal)', () => {
  it('GOOD payslip -> high confidence (>=90) and NO confidence finding', () => {
    const ctx = {
      assembly: payslipAssembly(),
      payslip: goodPayslip,
      forensics: [],
    } as unknown as CheckContext;

    const { score } = calculatePayslipConfidence(ctx);
    expect(score).toBeGreaterThanOrEqual(90);

    const findings = checkDocumentConfidence(ctx);
    expect(
      findings.filter((f) => f.rule_id === 'document-confidence' && f.status === 'open'),
    ).toHaveLength(0);
  });

  it('BAD/doctored payslip -> low confidence (<90) and a HIGH confidence finding fires', () => {
    const ctx = {
      assembly: payslipAssembly(1),
      payslip: doctoredPayslip,
      forensics: [
        {
          producer: 'x',
          creator: 'x',
          creation_date: null,
          modification_date: null,
          font_runs: {
            total_characters: 100,
            unique_fonts: 2,
            dominant_font: 'f1',
            anomalous_characters: 12,
          },
          monetary_anomalies: { flagged_regions: 1, highest_confidence_anomaly: 0.9 },
        },
      ],
    } as unknown as CheckContext;

    const { score } = calculatePayslipConfidence(ctx);
    expect(score).toBeLessThan(90);

    const findings = checkDocumentConfidence(ctx);
    const finding = findings.find(
      (f) => f.rule_id === 'document-confidence' && f.status === 'open',
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('high');
  });

  it('GOOD form16 -> high confidence (100) and NO confidence finding', () => {
    const ctx = {
      assembly: form16Assembly(),
      form16: {
        employee_name: 'Priya Sharma',
        employee_pan: 'ABCPS1234F',
        employer_name: 'Tech Corp India Pvt Ltd',
        employer_tan: 'MUMC12345B',
        employer_pan: 'AAACT1234C',
        financial_year: '2023-24',
        assessment_year: '2024-25',
        total_tax_deducted: 102000,
        total_tax_deposited: 102000,
        gross_total_income: 1172400,
        total_salary: 1172400,
        exempt_allowances: 38400,
        standard_deduction: 50000,
        professional_tax: 2400,
        net_taxable_salary: 1081600,
        total_income_tax_payable: 102000,
        extraction_notes: null,
        schema_version: 'form16-v1' as const,
      },
      forensics: [],
    } as unknown as CheckContext;

    expect(calculateForm16Confidence(ctx).score).toBe(100);
    const findings = checkDocumentConfidence(ctx);
    expect(
      findings.filter((f) => f.rule_id === 'document-confidence' && f.status === 'open'),
    ).toHaveLength(0);
  });

  it('BAD form16 with forensics anomaly -> low confidence and a confidence finding fires', () => {
    const ctx = {
      assembly: form16Assembly(1),
      form16: {
        employee_name: 'Priya Sharma',
        employee_pan: 'ABCPS1234F',
        employer_name: 'Tech Corp India Pvt Ltd',
        employer_tan: 'MUMC12345B',
        employer_pan: 'AAACT1234C',
        financial_year: '2023-24',
        assessment_year: '2024-25',
        total_tax_deducted: 102000,
        total_tax_deposited: 102000,
        gross_total_income: 1172400,
        total_salary: 1172400,
        exempt_allowances: 38400,
        standard_deduction: 50000,
        professional_tax: 2400,
        net_taxable_salary: 1081600,
        total_income_tax_payable: 102000,
        extraction_notes: null,
        schema_version: 'form16-v1' as const,
      },
      forensics: [
        {
          font_runs: {
            total_characters: 100,
            unique_fonts: 3,
            dominant_font: 'f2',
            anomalous_characters: 8,
          },
          monetary_anomalies: null,
        },
      ],
    } as unknown as CheckContext;

    const { score } = calculateForm16Confidence(ctx);
    expect(score).toBeLessThan(90);
    const findings = checkDocumentConfidence(ctx);
    expect(findings.some((f) => f.rule_id === 'document-confidence' && f.status === 'open')).toBe(
      true,
    );
  });
});
