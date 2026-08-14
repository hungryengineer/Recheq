import { z } from 'zod';
import { DocumentKind, DocumentStatus } from './enums.js';

// ─── Document Record ────────────────────────────────────────────
export const DocumentRecord = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  kind: DocumentKind,
  status: DocumentStatus,
  /** Original filename as uploaded by the candidate */
  original_filename: z.string(),
  /** MIME type determined from content sniffing, not extension */
  mime_type: z.string(),
  /** SHA-256 hash of the file content */
  sha256: z.string().length(64),
  /** File size in bytes */
  size_bytes: z.number().int().positive(),
  /** Storage path (private, never exposed to client) */
  storage_path: z.string(),
  uploaded_at: z.string().datetime(),
});
export type DocumentRecord = z.infer<typeof DocumentRecord>;

// ─── Payslip Extraction (all numeric fields nullable per spec) ──
export const PayslipExtraction = z.object({
  employee_name: z.string().nullable(),
  employer_name: z.string().nullable(),
  month: z.string().nullable(),
  year: z.number().int().nullable(),
  /** Raw printed label for basic salary */
  basic_raw_label: z.string().nullable(),
  basic: z.number().nullable(),
  hra: z.number().nullable(),
  da: z.number().nullable(),
  special_allowance: z.number().nullable(),
  other_allowances: z.number().nullable(),
  gross_salary: z.number().nullable(),
  pf_deduction: z.number().nullable(),
  professional_tax: z.number().nullable(),
  income_tax: z.number().nullable(),
  other_deductions: z.number().nullable(),
  total_deductions: z.number().nullable(),
  net_salary: z.number().nullable(),
  /** Any notes about extraction difficulties */
  extraction_notes: z.string().nullable(),
});
export type PayslipExtraction = z.infer<typeof PayslipExtraction>;

// ─── Form 16 Extraction (all numeric fields nullable) ───────────
export const Form16Extraction = z.object({
  employee_name: z.string().nullable(),
  employer_name: z.string().nullable(),
  pan: z.string().nullable(),
  tan: z.string().nullable(),
  financial_year: z.string().nullable(),
  assessment_year: z.string().nullable(),
  gross_total_income: z.number().nullable(),
  total_tax_deducted: z.number().nullable(),
  total_salary: z.number().nullable(),
  /** Any notes about extraction difficulties */
  extraction_notes: z.string().nullable(),
});
export type Form16Extraction = z.infer<typeof Form16Extraction>;

// ─── Document Upload Input ──────────────────────────────────────
export const DocumentUploadInput = z.object({
  /** Type of document being uploaded */
  kind: DocumentKind,
  /** Original filename as provided by the uploader */
  original_filename: z.string().min(1).max(500),
});
export type DocumentUploadInput = z.infer<typeof DocumentUploadInput>;
