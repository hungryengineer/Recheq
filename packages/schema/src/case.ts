import { z } from 'zod';
import { CaseStatus, Verdict } from './enums.js';

// ─── Case Creation Input ────────────────────────────────────────
export const CaseCreateInput = z.object({
  /** Employer name for the verification */
  employer_name: z.string().min(1).max(500),
  /** Candidate full name */
  candidate_name: z.string().min(1).max(500),
  /** Candidate email */
  candidate_email: z.string().email().max(255),
  /** Case title / description */
  title: z.string().min(1).max(1000),
  /** Claimed CTC (Cost to Company) in INR */
  claimed_ctc: z.number().positive(),
  /** Employment start date (ISO 8601) */
  employment_start: z.string().date(),
  /** Employment end date (ISO 8601) */
  employment_end: z.string().date(),
  /** Optional UAN (Universal Account Number) */
  uan: z.string().max(20).optional().nullable(),
});
export type CaseCreateInput = z.infer<typeof CaseCreateInput>;

// ─── Case Record ────────────────────────────────────────────────
export const CaseRecord = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  created_by: z.string().uuid(),
  employer_name: z.string(),
  candidate_name: z.string(),
  candidate_email: z.string().email().max(255),
  title: z.string(),
  claimed_ctc: z.number(),
  employment_start: z.string(),
  employment_end: z.string(),
  uan: z.string().nullable(),
  status: CaseStatus,
  verdict: Verdict.nullable(),
  risk_score: z.number().int().min(0).max(100).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type CaseRecord = z.infer<typeof CaseRecord>;

// ─── Case Summary (for list views) ─────────────────────────────
export const CaseSummary = z.object({
  id: z.string().uuid(),
  employer_name: z.string(),
  candidate_name: z.string(),
  candidate_email: z.string().email().max(255),
  title: z.string(),
  status: CaseStatus,
  verdict: Verdict.nullable(),
  risk_score: z.number().int().min(0).max(100).nullable(),
  created_at: z.string().datetime(),
});
export type CaseSummary = z.infer<typeof CaseSummary>;
