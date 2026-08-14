import crypto from 'node:crypto';
import type {
  CaseRecord,
  CaseStatus,
  ConsentRecord,
  EventInput,
  EventRecord,
} from '@tieout/schema';
import { ConsentGrantInput as ConsentGrantInputSchema } from '@tieout/schema';
import { transitionCaseStatus } from '../../domain/case-status.js';
import { validationError, notFoundError, conflictError } from '../../http/errors.js';

// ─── Candidate-Safe View ────────────────────────────────────────
// This projection intentionally excludes risk_score, verdict, org_id,
// created_by, and any verifier-internal information.

export interface CandidateSafeView {
  employer_name: string;
  candidate_name: string;
  title: string;
  status: CaseStatus;
  consent_status: 'pending' | 'granted' | 'withdrawn' | null;
}

// ─── Consent Metadata ───────────────────────────────────────────
// Captured from the HTTP request at the route layer, not from the body.

export interface ConsentMeta {
  ip_address: string | null;
  user_agent: string | null;
  token_hash: string | null;
}

// ─── Service Dependencies ───────────────────────────────────────

export interface ConsentServiceDeps {
  db: {
    getCaseById: (caseId: string) => Promise<CaseRecord | null>;
    updateCaseStatus: (caseId: string, status: CaseStatus) => Promise<void>;
    createConsent: (input: {
      case_id: string;
      status: 'granted';
      consent_text: string;
      consent_version: string;
      granted_at: string;
      ip_address: string | null;
      user_agent: string | null;
      withdrawn_at: null;
      token_hash: string | null;
    }) => Promise<ConsentRecord>;
    getConsentByCaseId: (caseId: string) => Promise<ConsentRecord | null>;
    updateConsentStatus: (
      consentId: string,
      status: 'withdrawn',
      withdrawnAt: string,
    ) => Promise<void>;
  };
  audit: {
    appendEvent: (tx: unknown, input: EventInput) => Promise<EventRecord>;
  };
}

// ─── Get Candidate-Safe View ────────────────────────────────────

/**
 * Returns a projection of the case that is safe to show to the candidate.
 * Never exposes risk_score, verdict, findings, or org-internal data.
 */
export async function getCandidateView(
  caseId: string,
  deps: ConsentServiceDeps,
): Promise<CandidateSafeView> {
  const caseRecord = await deps.db.getCaseById(caseId);

  if (!caseRecord) {
    throw notFoundError('Case not found');
  }

  const consent = await deps.db.getConsentByCaseId(caseId);

  return {
    employer_name: caseRecord.employer_name,
    candidate_name: caseRecord.candidate_name,
    title: caseRecord.title,
    status: caseRecord.status,
    consent_status: consent?.status ?? null,
  };
}

// ─── Grant Consent ──────────────────────────────────────────────

/**
 * Stores verbatim consent text/version with timestamp, IP, and user agent.
 * Transitions the case from awaiting_consent → awaiting_documents.
 * Appends a consent_granted audit event.
 *
 * Idempotency: if consent was already granted, returns a conflict error
 * rather than creating a duplicate consent record.
 */
export async function grantConsent(
  caseId: string,
  input: unknown,
  meta: ConsentMeta,
  deps: ConsentServiceDeps,
): Promise<ConsentRecord> {
  // Validate input schema
  const parsed = ConsentGrantInputSchema.safeParse(input);
  if (!parsed.success) {
    throw validationError('Invalid consent input', parsed.error.errors);
  }
  const data = parsed.data;

  const caseRecord = await deps.db.getCaseById(caseId);
  if (!caseRecord) {
    throw notFoundError('Case not found');
  }

  // Check for existing consent (idempotency guard)
  const existing = await deps.db.getConsentByCaseId(caseId);
  if (existing && existing.status === 'granted') {
    throw conflictError('Consent already granted for this case');
  }

  // Validate state machine transition — throws INVALID_TRANSITION if not allowed
  const newStatus = transitionCaseStatus(caseRecord.status, 'consent_granted');

  const grantedAt = new Date().toISOString();

  // Create consent record
  const consent = await deps.db.createConsent({
    case_id: caseId,
    status: 'granted',
    consent_text: data.consent_text,
    consent_version: data.consent_version,
    granted_at: grantedAt,
    ip_address: meta.ip_address,
    user_agent: meta.user_agent,
    withdrawn_at: null,
    token_hash: meta.token_hash,
  });

  // Transition case status
  await deps.db.updateCaseStatus(caseId, newStatus);

  // Append audit event
  await deps.audit.appendEvent(null, {
    case_id: caseId,
    kind: 'consent_granted',
    payload: {
      consent_id: consent.id,
      consent_version: data.consent_version,
    },
    actor: 'candidate',
  });

  return consent;
}

// ─── Withdraw Consent ───────────────────────────────────────────

/**
 * Records withdrawn_at on the consent, transitions the case to withdrawn,
 * and appends a consent_withdrawn audit event.
 *
 * After withdrawal, candidates cannot submit more documents.
 */
export async function withdrawConsent(caseId: string, deps: ConsentServiceDeps): Promise<void> {
  const caseRecord = await deps.db.getCaseById(caseId);
  if (!caseRecord) {
    throw notFoundError('Case not found');
  }

  const consent = await deps.db.getConsentByCaseId(caseId);
  if (!consent) {
    throw notFoundError('No consent record found for this case');
  }

  if (consent.status === 'withdrawn') {
    throw conflictError('Consent already withdrawn');
  }

  // Validate state machine transition — throws INVALID_TRANSITION if not allowed
  const newStatus = transitionCaseStatus(caseRecord.status, 'withdrawn');

  const withdrawnAt = new Date().toISOString();

  // Update consent status
  await deps.db.updateConsentStatus(consent.id, 'withdrawn', withdrawnAt);

  // Transition case status
  await deps.db.updateCaseStatus(caseId, newStatus);

  // Append audit event
  await deps.audit.appendEvent(null, {
    case_id: caseId,
    kind: 'consent_withdrawn',
    payload: {
      consent_id: consent.id,
      withdrawn_at: withdrawnAt,
    },
    actor: 'candidate',
  });
}

// ─── Token Hash Utility ─────────────────────────────────────────

/**
 * Computes the SHA-256 hash of a raw token for consent record linkage.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
