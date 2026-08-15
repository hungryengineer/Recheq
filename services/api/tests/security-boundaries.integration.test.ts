import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { generateToken } from '../src/tokens/generate-token.js';
import {
  verifyToken,
  TokenExpiredError,
  InvalidTokenPurposeError,
  InvalidTokenError,
  type TokenRecord,
} from '../src/tokens/verify-token.js';
import { TokenService, type ITokenRepository } from '../src/tokens/token-service.js';
import { resolveToken, type TokenVerifier } from '../src/routes/public/token-auth.js';
import { getCandidateHandler } from '../src/routes/public/candidate.js';
import { getEmployerHandler } from '../src/routes/public/employer.js';
import { getCaseHandler } from '../src/routes/cases/get.js';
import { listCasesHandler } from '../src/routes/cases/list.js';
import { getCandidateView } from '../src/services/consent/consent-service.js';
import { getCase, listCases } from '../src/services/cases/case-service.js';
import { sanitizeSensitiveFields } from '../src/security/request-validation.js';

// ─── Helpers ────────────────────────────────────────────────────

function makeRecord(
  rawToken: string,
  purpose: 'consent' | 'employer',
  expiresOffset = 3_600_000,
): TokenRecord {
  return {
    hash: crypto.createHash('sha256').update(rawToken).digest('hex'),
    case_id: 'case-org-a',
    purpose,
    expires_at: new Date(Date.now() + expiresOffset).toISOString(),
  };
}

const mockCtx = { service: 'api', requestId: 'req-1', startedAtMs: Date.now() };

// ─── 1. Wrong Token ─────────────────────────────────────────────

describe('wrong token cannot access a case', () => {
  it('unknown token → InvalidTokenError', () => {
    const { rawToken } = generateToken('tie_');
    expect(() => verifyToken(rawToken, 'consent', null)).toThrow(InvalidTokenError);
  });

  it('hash-mismatched token → InvalidTokenError', () => {
    const { rawToken } = generateToken('tie_');
    const { rawToken: other } = generateToken('tie_');
    const record = makeRecord(other, 'consent');
    expect(() => verifyToken(rawToken, 'consent', record)).toThrow(InvalidTokenError);
  });

  it('unknown token maps to 401 via resolveToken', async () => {
    const verifier: TokenVerifier = {
      verifyAndGetCaseId: vi.fn().mockRejectedValue(new InvalidTokenError()),
    };
    await expect(resolveToken('bad-token', 'consent', verifier)).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    });
  });

  it('getCandidateHandler returns 401 for unknown token', async () => {
    const verifier: TokenVerifier = {
      verifyAndGetCaseId: vi.fn().mockRejectedValue(new InvalidTokenError()),
    };
    const result = await getCandidateHandler(
      { params: { token: 'bad' }, context: mockCtx },
      {
        tokenVerifier: verifier,
        db: {
          getCaseById: vi.fn(),
          updateCaseStatus: vi.fn(),
          createConsent: vi.fn(),
          getConsentByCaseId: vi.fn(),
          updateConsentStatus: vi.fn(),
        },
        audit: { appendEvent: vi.fn() },
      },
    );
    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({
      error: { code: 'INVALID_TOKEN' },
    });
  });
});

// ─── 2. Consent Token Cannot Access Employer Routes ─────────────

describe('consent token cannot call employer routes', () => {
  it('verifyToken throws InvalidTokenPurposeError for wrong purpose', () => {
    const { rawToken } = generateToken('tie_');
    const record = makeRecord(rawToken, 'consent');
    expect(() => verifyToken(rawToken, 'employer', record)).toThrow(InvalidTokenPurposeError);
  });

  it('resolveToken maps purpose mismatch to 403', async () => {
    const { rawToken } = generateToken('tie_');
    const verifier: TokenVerifier = {
      verifyAndGetCaseId: vi.fn().mockRejectedValue(new InvalidTokenPurposeError()),
    };
    await expect(resolveToken(rawToken, 'employer', verifier)).rejects.toMatchObject({
      statusCode: 403,
      code: 'INVALID_TOKEN_PURPOSE',
    });
  });

  it('getEmployerHandler rejects consent token with 403', async () => {
    const { rawToken } = generateToken('tie_');
    const verifyAndGetCaseId = vi.fn().mockRejectedValue(new InvalidTokenPurposeError());
    const verifier: TokenVerifier = { verifyAndGetCaseId };

    const result = await getEmployerHandler({ params: { token: rawToken }, context: mockCtx }, {
      tokenVerifier: verifier,
      db: {
        transaction: vi.fn(),
        getCaseById: vi.fn(),
        createEmployerRequest: vi.fn(),
        getEmployerRequestByToken: vi.fn(),
        updateEmployerRequestResponse: vi.fn(),
      } as unknown as EmployerRouteDeps['db'],
      audit: { appendEvent: vi.fn() },
      tokens: { saveToken: vi.fn() },
      worker: { enqueueReprocess: vi.fn() },
    } as unknown as EmployerRouteDeps);
    expect(result.status).toBe(403);
    expect(verifyAndGetCaseId).toHaveBeenCalledWith(rawToken, 'employer');
    expect(result.body).toMatchObject({
      error: { code: 'INVALID_TOKEN_PURPOSE' },
    });
  });

  it('TokenService cross-purpose rejection is consistent', async () => {
    const repo: ITokenRepository = {
      saveToken: vi.fn(),
      getTokenByHash: vi.fn(),
    };
    const svc = new TokenService(repo);
    const rawToken = await svc.createToken('case-1', 'consent', 3_600_000);
    const saved = vi.mocked(repo.saveToken).mock.calls[0]![0];
    vi.mocked(repo.getTokenByHash).mockResolvedValue(saved);

    await expect(svc.verifyAndGetCaseId(rawToken, 'employer')).rejects.toThrow(
      InvalidTokenPurposeError,
    );
  });
});

// ─── 3. Expired Token Returns Correct Error ──────────────────────

describe('expired token returns correct error', () => {
  it('verifyToken throws TokenExpiredError for past expires_at', () => {
    const { rawToken } = generateToken('tie_');
    const record: TokenRecord = {
      hash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      case_id: 'case-1',
      purpose: 'consent',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    expect(() => verifyToken(rawToken, 'consent', record)).toThrow(TokenExpiredError);
  });

  it('verifyToken throws TokenExpiredError exactly at expires_at boundary', () => {
    const { rawToken } = generateToken('tie_');
    const now = new Date().toISOString();
    const record: TokenRecord = {
      hash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      case_id: 'case-1',
      purpose: 'consent',
      expires_at: now,
    };
    expect(() => verifyToken(rawToken, 'consent', record, now)).toThrow(TokenExpiredError);
  });

  it('resolveToken maps TokenExpiredError to 410', async () => {
    const { rawToken } = generateToken('tie_');
    const verifier: TokenVerifier = {
      verifyAndGetCaseId: vi.fn().mockRejectedValue(new TokenExpiredError()),
    };
    await expect(resolveToken(rawToken, 'consent', verifier)).rejects.toMatchObject({
      statusCode: 410,
      code: 'TOKEN_EXPIRED',
    });
  });

  it('getCandidateHandler returns 410 for expired token', async () => {
    const { rawToken } = generateToken('tie_');
    const verifier: TokenVerifier = {
      verifyAndGetCaseId: vi.fn().mockRejectedValue(new TokenExpiredError()),
    };
    const result = await getCandidateHandler(
      { params: { token: rawToken }, context: mockCtx },
      {
        tokenVerifier: verifier,
        db: {
          getCaseById: vi.fn(),
          updateCaseStatus: vi.fn(),
          createConsent: vi.fn(),
          getConsentByCaseId: vi.fn(),
          updateConsentStatus: vi.fn(),
        },
        audit: { appendEvent: vi.fn() },
      },
    );
    expect(result.status).toBe(410);
    expect(result.body).toMatchObject({
      error: { code: 'TOKEN_EXPIRED' },
    });
  });
});

// ─── 4. Org A Cannot Access Org B Data ──────────────────────────

describe('organization A cannot access organization B data', () => {
  it('getCase with wrong orgId returns 404', async () => {
    const db = {
      getCaseByIdAndOrg: vi.fn().mockResolvedValue(null),
      createCase: vi.fn(),
      listCasesByOrg: vi.fn().mockResolvedValue([]),
    };
    await expect(getCase('case-org-b', 'org-a', { db })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(db.getCaseByIdAndOrg).toHaveBeenCalledWith('case-org-b', 'org-a');
  });

  it('getCaseHandler with wrong org returns 404, not 403 (prevents org existence disclosure)', async () => {
    const deps = {
      db: {
        getCaseByIdAndOrg: vi.fn().mockResolvedValue(null),
        createCase: vi.fn(),
        listCasesByOrg: vi.fn().mockResolvedValue([]),
      },
    };
    const result = await getCaseHandler(
      {
        params: { id: 'case-org-b' },
        context: mockCtx,
        auth: { userId: 'user-a', orgId: 'org-a' },
      },
      deps,
    );
    expect(result.status).toBe(404);
  });

  it('listCases only returns cases for the requesting org', async () => {
    const orgACases = [{ id: 'case-1', org_id: 'org-a' }];
    const db = {
      listCasesByOrg: vi.fn().mockResolvedValue(orgACases),
      createCase: vi.fn(),
      getCaseByIdAndOrg: vi.fn(),
    };
    const result = await listCases('org-a', { db });
    expect(db.listCasesByOrg).toHaveBeenCalledWith('org-a');
    expect(result).toEqual(orgACases);
  });

  it('listCasesHandler passes auth.orgId — never a user-supplied orgId', async () => {
    const db = {
      listCasesByOrg: vi.fn().mockResolvedValue([]),
      createCase: vi.fn(),
      getCaseByIdAndOrg: vi.fn(),
    };
    await listCasesHandler(
      { context: mockCtx, auth: { userId: 'user-a', orgId: 'org-a' } },
      { db },
    );
    expect(db.listCasesByOrg).toHaveBeenCalledWith('org-a');
    expect(db.listCasesByOrg).not.toHaveBeenCalledWith('org-b');
  });
});

// ─── 5. Candidate View Does Not Expose Verifier Data ────────────

describe('candidate view does not expose risk_score, verdict, findings, or org data', () => {
  const caseRecord = {
    id: 'case-1',
    org_id: 'org-secret',
    created_by: 'user-secret',
    employer_name: 'Acme Ltd',
    candidate_name: 'Jane Doe',
    title: 'Engineer',
    claimed_ctc: '1200000',
    employment_start: '2022-01-01',
    employment_end: '2023-01-01',
    uan: null,
    status: 'processing' as const,
    verdict: 'needs_review' as const,
    risk_score: 75,
    created_at: new Date(),
    updated_at: new Date(),
  };

  it('getCandidateView excludes risk_score, verdict, org_id, created_by', async () => {
    const deps = {
      db: {
        getCaseById: vi.fn().mockResolvedValue(caseRecord),
        getConsentByCaseId: vi.fn().mockResolvedValue({ status: 'granted' }),
        updateCaseStatus: vi.fn(),
        createConsent: vi.fn(),
        updateConsentStatus: vi.fn(),
      },
      audit: { appendEvent: vi.fn() },
    };

    const view = await getCandidateView('case-1', deps);

    expect(view).not.toHaveProperty('risk_score');
    expect(view).not.toHaveProperty('verdict');
    expect(view).not.toHaveProperty('org_id');
    expect(view).not.toHaveProperty('created_by');
    expect(view).not.toHaveProperty('claimed_ctc');
    expect(view).toHaveProperty('employer_name');
    expect(view).toHaveProperty('candidate_name');
    expect(view).toHaveProperty('status');
    expect(view).toHaveProperty('consent_status');
  });
});

// ─── 6. Sensitive Fields Absent From Responses ──────────────────

describe('service keys, DB URLs, LLM keys absent from serialised responses', () => {
  const sensitiveKeys = [
    'password',
    'secret',
    'token',
    'apiKey',
    'accessKey',
    'secretKey',
    'sessionToken',
    'privateKey',
    'dbPassword',
    'dbUrl',
    'secretAccessKey',
    'credential',
  ];

  it.each(sensitiveKeys)('sanitizeSensitiveFields redacts "%s"', (key) => {
    const payload = { [key]: 'super-secret-value', safe_field: 'visible' };
    const result = sanitizeSensitiveFields(payload);
    expect(result).toEqual({ [key]: '[REDACTED]', safe_field: 'visible' });
  });

  it('sanitizes nested sensitive fields', () => {
    const payload = {
      config: { dbUrl: 'postgresql://user:pass@localhost/db' },
      name: 'visible',
    };
    const result = sanitizeSensitiveFields(payload);
    expect(result).toEqual({ config: { dbUrl: '[REDACTED]' }, name: 'visible' });
  });

  it('sanitizes arrays of objects with sensitive fields', () => {
    const payload = [{ apiKey: 'sk-abc123' }, { name: 'safe' }];
    const result = sanitizeSensitiveFields(payload);
    expect(result).toEqual([{ apiKey: '[REDACTED]' }, { name: 'safe' }]);
  });

  it('does not expose DATABASE_URL-style values in response body', () => {
    const payload = {
      dbUrl: 'postgresql://postgres:postgres@localhost:5432/tieout',
      safe: 'value',
    };
    const result = sanitizeSensitiveFields(payload);
    expect(result).toEqual({ dbUrl: '[REDACTED]', safe: 'value' });
  });
});
