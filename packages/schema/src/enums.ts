import { z } from 'zod';

// ─── Case Status ────────────────────────────────────────────────
export const CaseStatus = z.enum([
  'draft',
  'awaiting_consent',
  'awaiting_documents',
  'processing',
  'awaiting_employer',
  'complete',
  'withdrawn',
]);
export type CaseStatus = z.infer<typeof CaseStatus>;

// ─── Verdict ────────────────────────────────────────────────────
// Frozen contract: NO "rejected" verdict is allowed.
export const Verdict = z.enum([
  'verified',
  'verified_with_notes',
  'needs_review',
  'insufficient_evidence',
]);
export type Verdict = z.infer<typeof Verdict>;

// ─── Finding Severity ───────────────────────────────────────────
export const FindingSeverity = z.enum(['high', 'medium', 'low']);
export type FindingSeverity = z.infer<typeof FindingSeverity>;

// ─── Finding Status ─────────────────────────────────────────────
export const FindingStatus = z.enum([
  'open',
  'disputed',
  'resolved',
  'not_assessed',
]);
export type FindingStatus = z.infer<typeof FindingStatus>;

// ─── Document Kind ──────────────────────────────────────────────
export const DocumentKind = z.enum(['payslip', 'form_16']);
export type DocumentKind = z.infer<typeof DocumentKind>;

// ─── Document Status ────────────────────────────────────────────
export const DocumentStatus = z.enum([
  'pending',
  'processing',
  'extracted',
  'failed',
]);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

// ─── Consent Status ─────────────────────────────────────────────
export const ConsentStatus = z.enum(['pending', 'granted', 'withdrawn']);
export type ConsentStatus = z.infer<typeof ConsentStatus>;

// ─── Token Purpose ──────────────────────────────────────────────
export const TokenPurpose = z.enum(['consent', 'employer']);
export type TokenPurpose = z.infer<typeof TokenPurpose>;

// ─── Event Kind (audit events) ──────────────────────────────────
export const EventKind = z.enum([
  'case_created',
  'case_status_changed',
  'consent_granted',
  'consent_withdrawn',
  'document_uploaded',
  'document_deduplicated',
  'extraction_started',
  'extraction_completed',
  'extraction_failed',
  'forensics_completed',
  'forensics_failed',
  'epfo_lookup_completed',
  'epfo_lookup_failed',
  'rules_executed',
  'findings_persisted',
  'verdict_calculated',
  'finding_disputed',
  'employer_request_sent',
  'employer_reminder_sent',
  'employer_response_received',
  'case_reprocessed',
  'case_deleted',
  'token_generated',
  'token_expired',
]);
export type EventKind = z.infer<typeof EventKind>;
