import { describe, it, expect, vi, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.crypto) globalThis.crypto = webcrypto as any;
import {
  verifySessionToken,
  revokeSession,
  revokeAllSessionsForUser,
  pruneRevokedTokens,
  type SessionRevocationRepo,
} from '../src/security/session.js';
import { signToken, _clearSecretKeyForTest, type JwtClaims } from '../src/security/jwt.js';

// Mock db object capturing inserts/selects so we can drive the revocation logic
// without a real database.
type MockDb = {
  insert?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
  select?: ReturnType<typeof vi.fn>;
};

function makeMockDb(overrides: Record<string, unknown> = {}): MockDb {
  return {
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    select: vi.fn(),
    ...overrides,
  };
}

function asDb(db: MockDb) {
  return db as never;
}

afterEach(() => {
  _clearSecretKeyForTest();
});

describe('session.ts revocation', () => {
  it('revokes a specific token jti via insert', async () => {
    const insertMock = vi.fn();
    const valuesMock = vi.fn().mockResolvedValue([]);
    insertMock.mockReturnValue({ values: valuesMock });
    const db = makeMockDb({ insert: insertMock });

    await revokeSession(
      asDb(db),
      { jti: 'jti-1', exp: new Date(Date.now() + 1000).toISOString() },
      'logout',
      'user-1',
    );
    expect(insertMock).toHaveBeenCalled();
    const inserted = valuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted).toMatchObject({ jti: 'jti-1', reason: 'logout', revoked_by: 'user-1' });
  });

  it('revokes all sessions for a user by bumping token_cutoff_at', async () => {
    const updateMock = vi.fn();
    const setMock = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    updateMock.mockReturnValue({ set: setMock });
    const db = makeMockDb({ update: updateMock });

    await revokeAllSessionsForUser(asDb(db), 'user-1');
    expect(setMock).toHaveBeenCalled();
  });

  it('prunes expired denylist entries', async () => {
    const selectMock = vi.fn();
    const deleteMock = vi.fn();
    const whereDeleteMock = vi.fn().mockResolvedValue([]);
    selectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ jti: 'old' }]) }),
    });
    deleteMock.mockReturnValue({ where: whereDeleteMock });
    const db = makeMockDb({ select: selectMock, delete: deleteMock });

    const count = await pruneRevokedTokens(asDb(db), new Date());
    expect(count).toBe(1);
    expect(whereDeleteMock).toHaveBeenCalled();
  });

  it('returns a revoked token as invalid', async () => {
    let claims: JwtClaims | null = null;
    const repo: SessionRevocationRepo = {
      isRevoked: vi.fn().mockResolvedValue(true),
      getTokenCutoff: vi.fn().mockResolvedValue(null),
    };

    const token = await signToken({ userId: 'u1', orgId: 'o1', role: 'verifier' });
    claims = await verifySessionToken(asDb(makeMockDb()), token, repo);
    expect(claims).toBeNull();
  });

  it('accepts a valid, unrevoked token', async () => {
    const repo: SessionRevocationRepo = {
      isRevoked: vi.fn().mockResolvedValue(false),
      getTokenCutoff: vi.fn().mockResolvedValue(null),
    };
    const token = await signToken({ userId: 'u1', orgId: 'o1', role: 'verifier' });
    const claims = await verifySessionToken(asDb(makeMockDb()), token, repo);
    expect(claims).not.toBeNull();
    expect(claims!.userId).toBe('u1');
    expect(claims!.jti).toBeTruthy();
  });

  it('rejects a token issued before a user cutoff', async () => {
    const repo: SessionRevocationRepo = {
      isRevoked: vi.fn().mockResolvedValue(false),
      // cutoff in the future relative to the token's iat
      getTokenCutoff: vi.fn().mockResolvedValue(new Date(Date.now() + 100_000)),
    };
    const token = await signToken({ userId: 'u1', orgId: 'o1', role: 'verifier' });
    const claims = await verifySessionToken(asDb(makeMockDb()), token, repo);
    expect(claims).toBeNull();
  });
});
