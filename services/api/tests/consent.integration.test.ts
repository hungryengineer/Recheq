import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCandidateView,
  grantConsent,
  withdrawConsent,
  hashToken,
  type ConsentServiceDeps,
  type ConsentMeta,
} from '../src/services/consent/consent-service.js';
import { AppError } from '../src/http/errors.js';
import type { CaseRecord, ConsentRecord } from '@tieout/schema';

// ─── Test Helpers ───────────────────────────────────────────────

function makeCaseRecord(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: 'case-001',
    org_id: 'org-001',
    created_by: 'user-001',
    employer_name: 'Acme Corp',
    candidate_name: 'Jane Doe',
    title: 'Senior Engineer BGV',
    claimed_ctc: 1800000,
    employment_start: '2021-01-01',
    employment_end: '2023-12-31',
    uan: null,
    status: 'awaiting_consent',
    verdict: null,
    risk_score: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeConsentRecord(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: 'consent-001',
    case_id: 'case-001',
    status: 'granted',
    consent_text: 'I consent to background verification.',
    consent_version: 'v1.0',
    granted_at: '2024-01-02T10:00:00Z',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    withdrawn_at: null,
    created_at: '2024-01-02T10:00:00Z',
    ...overrides,
  };
}

function makeDeps(): ConsentServiceDeps {
  return {
    db: {
      getCaseById: vi.fn(),
      updateCaseStatus: vi.fn().mockResolvedValue(undefined),
      createConsent: vi.fn(),
      getConsentByCaseId: vi.fn(),
      updateConsentStatus: vi.fn().mockResolvedValue(undefined),
    },
    audit: {
      appendEvent: vi.fn().mockResolvedValue({
        id: 'evt-001',
        case_id: 'case-001',
        seq: 1,
        kind: 'consent_granted',
        payload: {},
        hash: 'a'.repeat(64),
        prev_hash: null,
        actor: 'candidate',
        created_at: new Date().toISOString(),
      }),
    },
  };
}

const validConsentInput = {
  consent_text: 'I consent to background verification processing.',
  consent_version: 'v1.0',
};

const defaultMeta: ConsentMeta = {
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0 TestBrowser',
  token_hash: 'a'.repeat(64),
};

// ─── getCandidateView ───────────────────────────────────────────

describe('getCandidateView', () => {
  it('returns candidate-safe information (no risk_score, verdict, or org data)', async () => {
    const deps = makeDeps();
    const caseRecord = makeCaseRecord({
      risk_score: 85,
      verdict: 'needs_review',
    });
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(caseRecord);
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(null);

    const view = await getCandidateView('case-001', deps);

    expect(view).toEqual({
      employer_name: 'Acme Corp',
      candidate_name: 'Jane Doe',
      title: 'Senior Engineer BGV',
      status: 'awaiting_consent',
      consent_status: null,
    });
    // Verify sensitive fields are NOT present
    expect(view).not.toHaveProperty('risk_score');
    expect(view).not.toHaveProperty('verdict');
    expect(view).not.toHaveProperty('org_id');
    expect(view).not.toHaveProperty('created_by');
  });

  it('includes consent_status when consent exists', async () => {
    const deps = makeDeps();
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(makeConsentRecord());

    const view = await getCandidateView('case-001', deps);

    expect(view.consent_status).toBe('granted');
  });

  it('throws 404 for non-existent case', async () => {
    const deps = makeDeps();
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(null);

    await expect(getCandidateView('case-missing', deps)).rejects.toThrowError(AppError);
    await expect(getCandidateView('case-missing', deps)).rejects.toThrow(/not found/i);
  });
});

// ─── grantConsent ───────────────────────────────────────────────

describe('grantConsent', () => {
  let deps: ConsentServiceDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('creates consent record and transitions case to awaiting_documents', async () => {
    const caseRecord = makeCaseRecord({ status: 'awaiting_consent' });
    const expectedConsent = makeConsentRecord();

    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(caseRecord);
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createConsent).mockResolvedValueOnce(expectedConsent);

    const result = await grantConsent('case-001', validConsentInput, defaultMeta, deps);

    expect(result).toEqual(expectedConsent);
    expect(deps.db.createConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        case_id: 'case-001',
        status: 'granted',
        consent_text: validConsentInput.consent_text,
        consent_version: validConsentInput.consent_version,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0 TestBrowser',
        withdrawn_at: null,
      }),
    );
    expect(deps.db.updateCaseStatus).toHaveBeenCalledWith('case-001', 'awaiting_documents');
  });

  it('appends a consent_granted audit event', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createConsent).mockResolvedValueOnce(makeConsentRecord());

    await grantConsent('case-001', validConsentInput, defaultMeta, deps);

    expect(deps.audit.appendEvent).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        case_id: 'case-001',
        kind: 'consent_granted',
        actor: 'candidate',
      }),
    );
  });

  it('stores verbatim consent text and version', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createConsent).mockResolvedValueOnce(makeConsentRecord());

    const input = {
      consent_text: 'Specific legal text with <special> characters & symbols.',
      consent_version: 'v2.1-beta',
    };

    await grantConsent('case-001', input, defaultMeta, deps);

    expect(deps.db.createConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        consent_text: input.consent_text,
        consent_version: input.consent_version,
      }),
    );
  });

  it('stores IP address and user agent from metadata', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(null);
    vi.mocked(deps.db.createConsent).mockResolvedValueOnce(makeConsentRecord());

    const meta: ConsentMeta = {
      ip_address: '2001:db8::1',
      user_agent: 'CustomApp/1.0',
      token_hash: 'b'.repeat(64),
    };

    await grantConsent('case-001', validConsentInput, meta, deps);

    expect(deps.db.createConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: '2001:db8::1',
        user_agent: 'CustomApp/1.0',
        token_hash: 'b'.repeat(64),
      }),
    );
  });

  it('rejects invalid input schema', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord());

    await expect(
      grantConsent('case-001', { consent_text: '' }, defaultMeta, deps),
    ).rejects.toThrowError(AppError);
  });

  it('rejects when case is not in awaiting_consent status', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord({ status: 'draft' }));
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(null);

    await expect(grantConsent('case-001', validConsentInput, defaultMeta, deps)).rejects.toThrow();
  });

  it('rejects when consent was already granted', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValue(makeCaseRecord());
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValue(
      makeConsentRecord({ status: 'granted' }),
    );

    await expect(
      grantConsent('case-001', validConsentInput, defaultMeta, deps),
    ).rejects.toThrowError(AppError);
    await expect(grantConsent('case-001', validConsentInput, defaultMeta, deps)).rejects.toThrow(
      /already granted/i,
    );
  });

  it('throws 404 for non-existent case', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(null);

    await expect(
      grantConsent('case-missing', validConsentInput, defaultMeta, deps),
    ).rejects.toThrowError(AppError);
  });
});

// ─── withdrawConsent ────────────────────────────────────────────

describe('withdrawConsent', () => {
  let deps: ConsentServiceDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('records withdrawn_at, transitions case to withdrawn, appends audit event', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(
      makeCaseRecord({ status: 'awaiting_documents' }),
    );
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(makeConsentRecord());

    await withdrawConsent('case-001', deps);

    expect(deps.db.updateConsentStatus).toHaveBeenCalledWith(
      'consent-001',
      'withdrawn',
      expect.any(String),
    );
    expect(deps.db.updateCaseStatus).toHaveBeenCalledWith('case-001', 'withdrawn');
    expect(deps.audit.appendEvent).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        case_id: 'case-001',
        kind: 'consent_withdrawn',
        actor: 'candidate',
        payload: expect.objectContaining({
          consent_id: 'consent-001',
          withdrawn_at: expect.any(String),
        }),
      }),
    );
  });

  it('allows withdrawal from awaiting_consent state', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(
      makeCaseRecord({ status: 'awaiting_consent' }),
    );
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(
      makeConsentRecord({ status: 'pending' }),
    );

    await withdrawConsent('case-001', deps);

    expect(deps.db.updateCaseStatus).toHaveBeenCalledWith('case-001', 'withdrawn');
  });

  it('allows withdrawal from processing state', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord({ status: 'processing' }));
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(makeConsentRecord());

    await withdrawConsent('case-001', deps);

    expect(deps.db.updateCaseStatus).toHaveBeenCalledWith('case-001', 'withdrawn');
  });

  it('rejects withdrawal when consent was already withdrawn', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValue(
      makeCaseRecord({ status: 'awaiting_documents' }),
    );
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValue(
      makeConsentRecord({ status: 'withdrawn' }),
    );

    await expect(withdrawConsent('case-001', deps)).rejects.toThrowError(AppError);
    await expect(withdrawConsent('case-001', deps)).rejects.toThrow(/already withdrawn/i);
  });

  it('rejects withdrawal when no consent exists', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValue(makeCaseRecord());
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValue(null);

    await expect(withdrawConsent('case-001', deps)).rejects.toThrowError(AppError);
    await expect(withdrawConsent('case-001', deps)).rejects.toThrow(/no consent/i);
  });

  it('rejects withdrawal from terminal withdrawn case state', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(makeCaseRecord({ status: 'withdrawn' }));
    vi.mocked(deps.db.getConsentByCaseId).mockResolvedValueOnce(makeConsentRecord());

    // The state machine should reject withdrawn → withdrawn
    await expect(withdrawConsent('case-001', deps)).rejects.toThrow();
  });

  it('throws 404 for non-existent case', async () => {
    vi.mocked(deps.db.getCaseById).mockResolvedValueOnce(null);

    await expect(withdrawConsent('case-missing', deps)).rejects.toThrowError(AppError);
  });
});

// ─── hashToken ──────────────────────────────────────────────────

describe('hashToken', () => {
  it('produces a 64-character hex SHA-256 hash', () => {
    const hash = hashToken('tie_someRandomTokenValue');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
  });

  it('produces deterministic output for the same input', () => {
    const hash1 = hashToken('tie_abc123');
    const hash2 = hashToken('tie_abc123');
    expect(hash1).toBe(hash2);
  });

  it('produces different output for different inputs', () => {
    const hash1 = hashToken('tie_token_a');
    const hash2 = hashToken('tie_token_b');
    expect(hash1).not.toBe(hash2);
  });
});
