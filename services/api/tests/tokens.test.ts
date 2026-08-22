import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateToken } from '../src/tokens/generate-token.js';
import type { TokenRecord } from '../src/tokens/verify-token.js';
import {
  verifyToken,
  TokenExpiredError,
  InvalidTokenPurposeError,
  InvalidTokenError,
} from '../src/tokens/verify-token.js';
import type { ITokenRepository } from '../src/tokens/token-service.js';
import { TokenService } from '../src/tokens/token-service.js';

describe('generateToken', () => {
  it('generates a token with a prefix and valid base64url characters', () => {
    const { rawToken, tokenHash } = generateToken('tie_');
    expect(rawToken.startsWith('tie_')).toBe(true);
    // 32 bytes base64url encoded is exactly 43 characters, plus prefix length (4) = 47
    expect(rawToken.length).toBe(47);
    expect(tokenHash).toHaveLength(64); // SHA-256 hex length
  });
});

import { signToken, _clearSecretKeyForTest } from '../src/security/jwt.js';

describe('JWT Secret Validation', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    _clearSecretKeyForTest();
  });

  it('throws an error if JWT_SECRET is not set', async () => {
    delete process.env.JWT_SECRET;
    _clearSecretKeyForTest();
    await expect(signToken({ userId: 'u1', orgId: 'o1', role: 'admin' })).rejects.toThrow(
      /missing or less than 32 characters/,
    );
  });

  it('throws an error if JWT_SECRET is 31 characters', async () => {
    process.env.JWT_SECRET = 'a'.repeat(31);
    _clearSecretKeyForTest();
    await expect(signToken({ userId: 'u1', orgId: 'o1', role: 'admin' })).rejects.toThrow(
      /missing or less than 32 characters/,
    );
  });

  it('succeeds if JWT_SECRET is exactly 32 characters', async () => {
    process.env.JWT_SECRET = 'a'.repeat(32);
    _clearSecretKeyForTest();
    const token = await signToken({ userId: 'u1', orgId: 'o1', role: 'admin' });
    expect(typeof token).toBe('string');
  });
});

describe('verifyToken', () => {
  const { rawToken, tokenHash } = generateToken();
  const future = new Date(Date.now() + 100000).toISOString();
  const past = new Date(Date.now() - 100000).toISOString();

  const validRecord: TokenRecord = {
    hash: tokenHash,
    case_id: 'case-123',
    purpose: 'consent',
    expires_at: future,
  };

  it('passes for a valid, matching token', () => {
    expect(() => verifyToken(rawToken, 'consent', validRecord)).not.toThrow();
  });

  it('rejects if record is null', () => {
    expect(() => verifyToken(rawToken, 'consent', null)).toThrow(InvalidTokenError);
  });

  it('rejects if hash does not match', () => {
    expect(() => verifyToken('invalid-token', 'consent', validRecord)).toThrow(InvalidTokenError);
  });

  it('rejects if token is expired (410 equivalent)', () => {
    const expiredRecord = { ...validRecord, expires_at: past };
    expect(() => verifyToken(rawToken, 'consent', expiredRecord)).toThrow(TokenExpiredError);
  });

  it('rejects if purpose does not match', () => {
    expect(() => verifyToken(rawToken, 'employer', validRecord)).toThrow(InvalidTokenPurposeError);
  });
});

describe('TokenService', () => {
  it('creates and verifies tokens orchestrating the repository correctly', async () => {
    const mockRepo: ITokenRepository = {
      saveToken: vi.fn(),
      getTokenByHash: vi.fn(),
    };

    const service = new TokenService(mockRepo);

    // Create token
    const rawToken = await service.createToken('case-1', 'consent', 3600000);
    expect(rawToken).toBeTypeOf('string');
    expect(mockRepo.saveToken).toHaveBeenCalledOnce();

    const savedRecord = vi.mocked(mockRepo.saveToken).mock.calls[0]![0];
    expect(savedRecord.purpose).toBe('consent');
    expect(savedRecord.case_id).toBe('case-1');

    // Verify token
    vi.mocked(mockRepo.getTokenByHash).mockResolvedValue(savedRecord);

    const caseId = await service.verifyAndGetCaseId(rawToken, 'consent');
    expect(caseId).toBe('case-1');

    // Attempt verification with wrong purpose
    await expect(service.verifyAndGetCaseId(rawToken, 'employer')).rejects.toThrow(
      InvalidTokenPurposeError,
    );
  });
});
