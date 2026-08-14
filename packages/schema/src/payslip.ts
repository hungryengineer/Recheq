// ─── Payslip Extraction Schema ──────────────────────────────────
// Frozen contract for payslip extraction.
// All numeric fields are nullable — missing/illegible values must be null,
// never 0 or inferred.  The LLM must never compute arithmetic.

import { z } from 'zod';

// ─── Individual salary component ────────────────────────────────
// Each component preserves the raw printed label alongside the canonical value.
export const SalaryComponent = z.object({
  /** Exact label as printed on the document, e.g. "Basic Pay", "HRA", "LTA" */
  raw_label: z.string().nullable(),
  /** Canonical numeric value as printed; null when missing or illegible */
  amount: z.number().nullable(),
});
export type SalaryComponent = z.infer<typeof SalaryComponent>;

// ─── Payslip Extraction ─────────────────────────────────────────
export const PayslipExtractionV1 = z.object({
  // ── Identity ────────────────────────────────────────────────
  employee_name: z.string().nullable(),
  employee_id: z.string().nullable(),
  employer_name: z.string().nullable(),
  /** e.g. "January", "Feb", "01" — whatever is printed */
  month: z.string().nullable(),
  year: z.number().int().nullable(),

  // ── Earnings (each preserves raw label + printed amount) ────
  /**
   * Basic salary component.  raw_label must capture the exact printed text,
   * e.g. "Basic Salary", "Basic Pay", "Basic".
   */
  basic: SalaryComponent,
  hra: SalaryComponent,
  da: SalaryComponent,
  special_allowance: SalaryComponent,
  other_allowances: z.array(SalaryComponent),

  /**
   * Gross salary as printed on the document.
   * Must not be calculated by the extractor.
   */
  gross_salary: z.number().nullable(),

  // ── Deductions ───────────────────────────────────────────────
  pf_deduction: z.number().nullable(),
  professional_tax: z.number().nullable(),
  income_tax: z.number().nullable(),
  other_deductions: z.number().nullable(),
  /**
   * Total deductions as printed.
   * Must not be calculated by the extractor.
   */
  total_deductions: z.number().nullable(),

  /**
   * Net/take-home salary as printed.
   * Must not be calculated by the extractor.
   */
  net_salary: z.number().nullable(),

  // ── PF details (when printed) ────────────────────────────────
  /** Employee Provident Fund UAN — printed on some payslips */
  uan: z.string().nullable(),
  /** PF account number */
  pf_account_number: z.string().nullable(),

  // ── Metadata ─────────────────────────────────────────────────
  /**
   * Any extraction difficulty notes.  When the extractor cannot read a
   * field, it must set that field to null AND add an explanation here.
   */
  extraction_notes: z.string().nullable(),
  /** Schema version used during extraction */
  schema_version: z.literal('payslip-v1'),
});
export type PayslipExtractionV1 = z.infer<typeof PayslipExtractionV1>;
