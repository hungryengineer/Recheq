import { z } from 'zod';

// ─── Evidence Origin ────────────────────────────────────────────
// Tracks which independent sources contributed evidence for a case.
export const EvidenceOrigin = z.enum([
  'payslip',
  'form_16',
  'epfo',
  'employer',
  'forensics',
]);
export type EvidenceOrigin = z.infer<typeof EvidenceOrigin>;

// ─── Evidence Assembly ──────────────────────────────────────────
// Represents the assembled evidence for rule evaluation.
export const EvidenceAssembly = z.object({
  case_id: z.string().uuid(),
  /** Which independent sources provided evidence */
  origins: z.array(EvidenceOrigin),
  /** Whether payslip extraction is available */
  has_payslip: z.boolean(),
  /** Whether Form 16 extraction is available */
  has_form16: z.boolean(),
  /** Whether EPFO data is available */
  has_epfo: z.boolean(),
  /** Whether employer confirmation is available */
  has_employer: z.boolean(),
  /** Whether forensics data is available */
  has_forensics: z.boolean(),
});
export type EvidenceAssembly = z.infer<typeof EvidenceAssembly>;
