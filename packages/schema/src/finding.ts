import { z } from 'zod';
import { FindingSeverity, FindingStatus } from './enums.js';

// ─── Finding Record ─────────────────────────────────────────────
export const FindingRecord = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  /** Deterministic rule identifier, e.g. "CHK-PAYSLIP-ARITH" */
  rule_id: z.string().min(1),
  severity: FindingSeverity,
  status: FindingStatus,
  /** Human-readable rule title */
  title: z.string().min(1),
  /** Detailed explanation of the finding */
  explanation: z.string(),
  /** Expected value (stringified for display) */
  expected: z.string().nullable(),
  /** Observed value (stringified for display) */
  observed: z.string().nullable(),
  /** IDs of documents that were the source for this finding */
  source_document_ids: z.array(z.string().uuid()),
  /** Optional dispute context if finding was disputed */
  dispute_reason: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type FindingRecord = z.infer<typeof FindingRecord>;

// ─── Finding Input (for creating findings from rule execution) ──
export const FindingInput = z.object({
  rule_id: z.string().min(1),
  severity: FindingSeverity,
  status: FindingStatus,
  title: z.string().min(1),
  explanation: z.string(),
  expected: z.string().nullable(),
  observed: z.string().nullable(),
  source_document_ids: z.array(z.string().uuid()),
});
export type FindingInput = z.infer<typeof FindingInput>;
