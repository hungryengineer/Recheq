import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loginHandler,
  _clearLoginRateLimitsForTest,
  type LoginRepository,
} from '../src/routes/auth/login.js';
import bcrypt from 'bcryptjs';

describe('loginHandler', () => {
  let mockRepo: LoginRepository;
  const mockIp = '192.168.1.100';

  beforeEach(() => {
    _clearLoginRateLimitsForTest();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockRepo = {
      getUserByEmail: vi.fn().mockResolvedValue(null),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects with 400 if client IP is missing', async () => {
    const req = { body: { email: 'test@example.com', password: 'password123' } };
    const response = await loginHandler(req as any, { repo: mockRepo });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Client IP is required' },
    });
  });

  it('rejects with 401 if user does not exist', async () => {
    const req = { body: { email: 'unknown@example.com', password: 'password123' }, ip: mockIp };
    const response = await loginHandler(req, { repo: mockRepo });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
    });
  });

  it('never logs the submitted password on failure', async () => {
    const req = {
      body: { email: 'unknown@example.com', password: 'my-super-secret-password' },
      ip: mockIp,
    };
    await loginHandler(req, { repo: mockRepo });

    const warnCalls = vi.mocked(console.warn).mock.calls;
    expect(warnCalls.length).toBeGreaterThan(0);

    for (const args of warnCalls) {
      const msg = args.join(' ');
      expect(msg).not.toContain('my-super-secret-password');
      expect(msg).not.toContain('unknown@example.com'); // It should be hashed
    }
  });

  it('blocks request with 429 after 5 failed attempts for the same email', async () => {
    const req = { body: { email: 'test@example.com', password: 'password123' }, ip: mockIp };

    for (let i = 0; i < 5; i++) {
      const response = await loginHandler(req, { repo: mockRepo });
      expect(response.status).toBe(401);
    }

    const rateLimitedResponse = await loginHandler(req, { repo: mockRepo });
    expect(rateLimitedResponse.status).toBe(429);
    expect(rateLimitedResponse.headers?.['Retry-After']).toMatch(/^[1-9]\d*$/);
    expect(rateLimitedResponse.body).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
  });

  it('protects against timing attacks (delta < 50ms)', async () => {
    const validPasswordHash = bcrypt.hashSync('correct-password', 10);

    mockRepo.getUserByEmail = vi.fn().mockImplementation(async (email: string) => {
      if (email === 'known@example.com') {
        return {
          id: 'user-1',
          email: 'known@example.com',
          name: 'Admin User',
          password_hash: validPasswordHash,
          org_id: 'org-1',
          role: 'admin',
        };
      }
      return null;
    });

    const unknownReq = {
      body: { email: 'unknown@example.com', password: 'wrongpassword' },
      ip: mockIp,
    };
    const knownReq = {
      body: { email: 'known@example.com', password: 'wrongpassword' },
      ip: mockIp,
    };

    const measureTime = async (req: any) => {
      _clearLoginRateLimitsForTest();
      const start = process.hrtime.bigint();
      const response = await loginHandler(req, { repo: mockRepo });
      expect(response.status).toBe(401);
      const end = process.hrtime.bigint();
      return Number(end - start) / 1e6; // to ms
    };

    let unknownTotalMs = 0;
    let knownTotalMs = 0;
    const runs = 20;

    // Warm-up
    await measureTime(unknownReq);
    await measureTime(knownReq);

    for (let i = 0; i < runs; i++) {
      // Interleave to avoid caching bias
      unknownTotalMs += await measureTime(unknownReq);
      knownTotalMs += await measureTime(knownReq);
    }

    const unknownAvg = unknownTotalMs / runs;
    const knownAvg = knownTotalMs / runs;

    const delta = Math.abs(unknownAvg - knownAvg);

    // Timing delta should be minimal. We use 50ms as a safe CI tolerance.
    expect(delta).toBeLessThan(50);
  }, 15000);
});
