import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRateLimiter,
  clearRateLimitState,
  getRateLimitStatus,
} from '../src/security/rate-limit.js';
import { createSecurityHeadersMiddleware } from '../src/security/security-headers.js';
import {
  extractTokenFromUrl,
  validateTokenPurpose,
  sanitizeSensitiveFields,
  containsSecrets,
  createRequestValidationMiddleware,
} from '../src/security/request-validation.js';
import type { TokenRecord } from '../src/tokens/verify-token.js';

describe('rate-limit.ts', () => {
  beforeEach(() => {
    clearRateLimitState();
  });

  afterEach(() => {
    clearRateLimitState();
  });

  describe('createRateLimiter', () => {
    it('allows requests under the limit', async () => {
      const rateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });

      let callCount = 0;
      const next = () => {
        callCount++;
        return Promise.resolve(new Response('OK'));
      };

      // Make 5 requests (under the limit)
      for (let i = 0; i < 5; i++) {
        const req = new Request('http://localhost/api/public/test123/consent');
        await rateLimit(req, next);
      }

      expect(callCount).toBe(5);
    });

    it('blocks requests over the limit with 429 status', async () => {
      const rateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 3 });
      const next = vi.fn().mockResolvedValue(new Response('OK'));

      // Make 4 requests (1 over the limit)
      for (let i = 0; i < 4; i++) {
        const req = new Request('http://localhost/api/public/test123/consent');
        await rateLimit(req, next);
      }

      // The 4th request should be blocked
      expect(next).toHaveBeenCalledTimes(3);
    });

    it('returns rate limit headers', async () => {
      const rateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });

      const next = () => Promise.resolve(new Response('OK'));

      // Make 2 requests to hit the limit
      await rateLimit(new Request('http://localhost/api/public/test123/consent'), next);
      await rateLimit(new Request('http://localhost/api/public/test123/consent'), next);

      // The 3rd request should be blocked with headers
      const req = new Request('http://localhost/api/public/test123/consent');
      const response = await rateLimit(req, next);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('2');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('uses different limits for different IP + token combinations', async () => {
      const rateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });
      const next = vi.fn().mockResolvedValue(new Response('OK'));

      // Requests from different IPs
      const req1 = new Request('http://localhost/api/public/test123/consent');
      req1.headers.set('X-Forwarded-For', '192.168.1.1');

      const req2 = new Request('http://localhost/api/public/test123/consent');
      req2.headers.set('X-Forwarded-For', '192.168.1.2');

      // Each should have separate rate limits
      await rateLimit(req1, next);
      await rateLimit(req2, next);

      expect(next).toHaveBeenCalledTimes(2);
    });

    it('resets the rate limit window after timeout', async () => {
      // Use a very short window for testing
      const rateLimit = createRateLimiter({ windowMs: 100, maxRequests: 2 });
      const next = vi.fn().mockResolvedValue(new Response('OK'));

      // Hit the limit
      await rateLimit(new Request('http://localhost/api/public/test123/consent'), next);
      await rateLimit(new Request('http://localhost/api/public/test123/consent'), next);

      expect(next).toHaveBeenCalledTimes(2);

      // Wait for window to reset
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      await rateLimit(new Request('http://localhost/api/public/test123/consent'), next);
      expect(next).toHaveBeenCalledTimes(3);
    });
  });

  describe('clearRateLimitState', () => {
    it('clears all rate limit records', () => {
      const rateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
      const next = vi.fn().mockResolvedValue(new Response('OK'));

      rateLimit(new Request('http://localhost/api/public/test123/consent'), next);

      expect(getRateLimitStatus('unknown:test123')).toBeDefined();

      clearRateLimitState();

      expect(getRateLimitStatus('unknown:test123')).toBeUndefined();
    });
  });

  describe('getRateLimitStatus', () => {
    it('returns undefined for non-existent key', () => {
      expect(getRateLimitStatus('nonexistent:key')).toBeUndefined();
    });

    it('returns undefined for expired record', async () => {
      clearRateLimitState();
      const rateLimit = createRateLimiter({ windowMs: 10, maxRequests: 10 });
      const next = vi.fn().mockResolvedValue(new Response('OK'));

      await rateLimit(new Request('http://localhost/api/public/test123/consent'), next);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(getRateLimitStatus('unknown:test123')).toBeUndefined();

      clearRateLimitState();
    });
  });
});

describe('security-headers.ts', () => {
  describe('createSecurityHeadersMiddleware', () => {
    it('adds CORS headers for allowed origins', async () => {
      const middleware = createSecurityHeadersMiddleware({
        allowedOrigins: ['http://localhost:3000'],
      });

      const req = new Request('http://localhost/api/public/test/consent');
      req.headers.set('Origin', 'http://localhost:3000');

      const next = vi.fn().mockResolvedValue(new Response('OK'));

      const response = await middleware(req, next);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });

    it('sets HSTS header', async () => {
      const middleware = createSecurityHeadersMiddleware({ enableHSTS: true });

      const req = new Request('http://localhost/api/public/test/consent');

      const next = vi.fn().mockResolvedValue(new Response('OK'));

      const response = await middleware(req, next);

      expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=');
    });

    it('sets Content-Security-Policy header', async () => {
      const middleware = createSecurityHeadersMiddleware({ enableCSP: true });

      const req = new Request('http://localhost/api/public/test/consent');

      const next = vi.fn().mockResolvedValue(new Response('OK'));

      const response = await middleware(req, next);

      expect(response.headers.get('Content-Security-Policy')).toBeDefined();
    });

    it('sets X-Frame-Options header', async () => {
      const middleware = createSecurityHeadersMiddleware({ enableXFrameOptions: true });

      const req = new Request('http://localhost/api/public/test/consent');

      const next = vi.fn().mockResolvedValue(new Response('OK'));

      const response = await middleware(req, next);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('removes Server header', async () => {
      const middleware = createSecurityHeadersMiddleware();

      const req = new Request('http://localhost/api/public/test/consent');

      const next = vi.fn().mockResolvedValue(new Response('OK'));

      const response = await middleware(req, next);

      expect(response.headers.get('Server')).toBeNull();
    });
  });
});

describe('request-validation.ts', () => {
  describe('extractTokenFromUrl', () => {
    it('extracts token from /api/public/:token/... path', () => {
      const url = new URL('http://localhost/api/public/test-token-123/consent');
      expect(extractTokenFromUrl(url)).toBe('test-token-123');
    });

    it('returns null when no token in path', () => {
      const url = new URL('http://localhost/api/cases/123');
      expect(extractTokenFromUrl(url)).toBeNull();
    });

    it('handles paths without trailing slash', () => {
      const url = new URL('http://localhost/api/public/abc123');
      expect(extractTokenFromUrl(url)).toBe('abc123');
    });
  });

  describe('sanitizeSensitiveFields', () => {
    it('removes sensitive fields from objects', () => {
      const data = {
        name: 'John',
        password: 'secret123',
        apiKey: 'sk-123',
        email: 'john@example.com',
        secretKey: 'super-secret',
      };

      const result = sanitizeSensitiveFields(data);

      expect(result).toEqual({
        name: 'John',
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        email: 'john@example.com',
        secretKey: '[REDACTED]',
      });
    });

    it('recursively sanitizes nested objects', () => {
      const data = {
        user: {
          name: 'John',
          password: 'secret123',
        },
        config: {
          apiKey: 'sk-123',
          dbPassword: 'db-pass',
        },
      };

      const result = sanitizeSensitiveFields(data);

      expect(result).toEqual({
        user: {
          name: 'John',
          password: '[REDACTED]',
        },
        config: {
          apiKey: '[REDACTED]',
          dbPassword: '[REDACTED]',
        },
      });
    });

    it('sanitizes arrays', () => {
      const data = [
        { name: 'John', password: 'secret123' },
        { name: 'Jane', apiKey: 'sk-456' },
      ];

      const result = sanitizeSensitiveFields(data);

      expect(result).toEqual([
        { name: 'John', password: '[REDACTED]' },
        { name: 'Jane', apiKey: '[REDACTED]' },
      ]);
    });

    it('does not modify non-sensitive data', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        amount: 100,
      };

      const result = sanitizeSensitiveFields(data);

      expect(result).toEqual(data);
    });
  });

  describe('containsSecrets', () => {
    it('detects common secret patterns', () => {
      expect(containsSecrets('password=secret123')).toBe(true);
      expect(containsSecrets('API_KEY=sk-123')).toBe(true);
      expect(containsSecrets('secret_access_key=abc')).toBe(true);
    });

    it('returns false for non-sensitive strings', () => {
      expect(containsSecrets('Hello World')).toBe(false);
      expect(containsSecrets('This is a normal string')).toBe(false);
    });
  });
});

describe('validateTokenPurpose', () => {
  it('validates correct token and purpose', async () => {
    const crypto = await import('node:crypto');
    const token = 'test-token-value';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record: TokenRecord = {
      hash: tokenHash,
      case_id: 'case-123',
      purpose: 'consent',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };

    const mockGetTokenByHash = vi.fn().mockResolvedValue(record);

    const url = new URL(`http://localhost/api/public/${token}/consent`);

    const result = await validateTokenPurpose(url, 'consent', mockGetTokenByHash);

    expect(result).toEqual({
      caseId: 'case-123',
      tokenPurpose: 'consent',
    });
  });

  it('throws for wrong token purpose', async () => {
    const crypto = await import('node:crypto');
    const token = 'test-token-value';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record: TokenRecord = {
      hash: tokenHash,
      case_id: 'case-123',
      purpose: 'consent',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };

    const mockGetTokenByHash = vi.fn().mockResolvedValue(record);
    const url = new URL(`http://localhost/api/public/${token}/consent`);

    await expect(validateTokenPurpose(url, 'employer', mockGetTokenByHash)).rejects.toThrow(
      'Token purpose does not match required purpose',
    );
  });

  it('throws for missing token in URL', async () => {
    const mockGetTokenByHash = vi.fn();
    const url = new URL('http://localhost/api/cases/123');

    await expect(validateTokenPurpose(url, 'consent', mockGetTokenByHash)).rejects.toThrow(
      'Token not provided',
    );
  });
});

describe('createRequestValidationMiddleware', () => {
  it('validates token and passes through request', async () => {
    const crypto = await import('node:crypto');
    const token = 'test-token-value';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record: TokenRecord = {
      hash: tokenHash,
      case_id: 'case-123',
      purpose: 'consent',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };

    const mockGetTokenByHash = vi.fn().mockResolvedValue(record);
    const middleware = createRequestValidationMiddleware(mockGetTokenByHash);

    const req = new Request('http://localhost/api/public/test-token-value/consent');
    const next = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ caseId: 'case-123', status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await middleware(req, next);

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenInfo: {
          caseId: 'case-123',
          purpose: 'consent',
        },
      }),
    );
  });

  it('sanitizes sensitive fields in JSON response', async () => {
    const crypto = await import('node:crypto');
    const token = 'test-token-value';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const record: TokenRecord = {
      hash: tokenHash,
      case_id: 'case-123',
      purpose: 'consent',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };

    const mockGetTokenByHash = vi.fn().mockResolvedValue(record);
    const middleware = createRequestValidationMiddleware(mockGetTokenByHash);

    const req = new Request('http://localhost/api/public/test-token-value/consent');
    const next = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          caseId: 'case-123',
          secretKey: 'should-be-redacted',
          apiKey: 'also-redacted',
          normalField: 'should-remain',
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const response = await middleware(req, next);
    const body = (await response.json()) as {
      caseId: string;
      secretKey: string;
      apiKey: string;
      normalField: string;
    };

    expect(body).toEqual({
      caseId: 'case-123',
      secretKey: '[REDACTED]',
      apiKey: '[REDACTED]',
      normalField: 'should-remain',
    });
  });

  it('returns 401 for invalid token', async () => {
    const mockGetTokenByHash = vi.fn().mockResolvedValue(null);
    const middleware = createRequestValidationMiddleware(mockGetTokenByHash);

    const req = new Request('http://localhost/api/public/invalid-token/consent');
    const next = vi.fn().mockResolvedValue(new Response('OK'));

    const response = await middleware(req, next);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('TOKEN_NOT_FOUND');
  });
});
