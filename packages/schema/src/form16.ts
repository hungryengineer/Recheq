// ─── Form 16 Extraction Schema ──────────────────────────────────
// Frozen contract for Form 16 (Part A + Part B) extraction.
// All numeric fields are nullable — missing/illegible values must be null,
// never 0 or inferred.  The LLM must never compute arithmetic.

import { z } from 'zod';

// ─── Form 16 Extraction ─────────────────────────────────────────
export const Form16ExtractionV1 = z.object({
  // ── Identity ────────────────────────────────────────────────
  employee_name: z.string().nullable(),
  employee_pan: z.string().nullable(),
  /** Employer name as printed (deductor name) */
  employer_name: z.string().nullable(),
  /** Employer TAN (Tax Deduction Account Number) */
  employer_tan: z.string().nullable(),
  /** Employer PAN */
  employer_pan: z.string().nullable(),

  // ── Period ───────────────────────────────────────────────────
  /** Financial year string exactly as printed, e.g. "2023-24" */
  financial_year: z.string().nullable(),
  /** Assessment year exactly as printed, e.g. "2024-25" */
  assessment_year: z.string().nullable(),

  // ── Part A — TDS summary ─────────────────────────────────────
  /** Total amount of TDS deducted and deposited */
  total_tax_deducted: z.number().nullable(),
  /** Total amount deposited to government */
  total_tax_deposited: z.number().nullable(),

  // ── Part B — Salary breakdown ────────────────────────────────
  /** Gross salary as printed in Part B */
  gross_total_income: z.number().nullable(),
  /** Total salary as printed (may differ from gross due to exemptions) */
  total_salary: z.number().nullable(),
  /** Allowances exempt under section 10 */
  exempt_allowances: z.number().nullable(),
  /** Standard deduction amount */
  standard_deduction: z.number().nullable(),
  /** Professional tax deducted */
  professional_tax: z.number().nullable(),
  /** Net taxable salary after deductions */
  net_taxable_salary: z.number().nullable(),
  /** Total income tax payable */
  total_income_tax_payable: z.number().nullable(),

  // ── Metadata ─────────────────────────────────────────────────
  /**
   * Any extraction difficulty notes.  When the extractor cannot read a
   * field, it must set that field to null AND add an explanation here.
   */
  extraction_notes: z.string().nullable(),
  /** Schema version used during extraction */
  schema_version: z.literal('form16-v1'),
});
export type Form16ExtractionV1 = z.infer<typeof Form16ExtractionV1>;
