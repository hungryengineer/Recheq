import { describe, it, expect } from 'vitest';
import { calculatePayslipConfidence, calculateForm16Confidence } from '../src/confidence.js';
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
