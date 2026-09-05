import { describe, it, expect, vi } from 'vitest';
import {
  createSqlRateLimitStore,
  type RateLimitCounterRepo,
} from '../src/security/sql-rate-limit-store.js';

function fakeRepo(overrides?: Partial<RateLimitCounterRepo>): {
  repo: RateLimitCounterRepo;
  calls: Array<{ scope: string; key: string; windowMs: number; maxRequests: number }>;
} {
  const calls: Array<{ scope: string; key: string; windowMs: number; maxRequests: number }> = [];
  const repo: RateLimitCounterRepo = {
    incrementWindow: vi.fn(async ({ scope, key, windowMs, maxRequests }) => {
      calls.push({ scope, key, windowMs, maxRequests });
      return {
        count: 1,
        max_requests: maxRequests,
        window_end: new Date(Date.now() + windowMs),
      };
    }),
    ...overrides,
  };
  return { repo, calls };
}

describe('sql-rate-limit-store.ts', () => {
  it('allows a request within its budget', async () => {
    const { repo } = fakeRepo();
    const store = createSqlRateLimitStore(repo);
    const result = await store.increment({
      scope: 'public',
      key: '1.2.3.4:token-a',
      windowMs: 60_000,
      maxRequests: 10,
    });
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('blocks when the count has crossed the limit', async () => {
    const { repo } = fakeRepo({
      incrementWindow: vi.fn().mockResolvedValue({
        count: 11,
        max_requests: 10,
        window_end: new Date(Date.now() + 5_000),
      }),
    });
    const store = createSqlRateLimitStore(repo);
    const result = await store.increment({
      scope: 'login_email',
      key: 'a@b.io',
      windowMs: 900_000,
      maxRequests: 10,
    });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeDefined();
  });

  it('delegates scope/key/window to the counter repo', async () => {
    const { repo, calls } = fakeRepo();
    const store = createSqlRateLimitStore(repo);
    await store.increment({
      scope: 'login_ip',
      key: '9.9.9.9',
      windowMs: 900_000,
      maxRequests: 20,
    });
    expect(calls).toEqual([
      { scope: 'login_ip', key: '9.9.9.9', windowMs: 900_000, maxRequests: 20 },
    ]);
  });

  it('propagates counter repo errors', async () => {
    const { repo } = fakeRepo({
      incrementWindow: vi.fn().mockRejectedValue(new Error('db down')),
    });
    const store = createSqlRateLimitStore(repo);
    await expect(
      store.increment({ scope: 'public', key: 'k', windowMs: 1000, maxRequests: 1 }),
    ).rejects.toThrow('db down');
  });
});