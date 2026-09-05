import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!globalThis.crypto) globalThis.crypto = webcrypto as any;
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

/**
 * RCQ-20110 (KAN-20 / plan RCQ-20106) — dashboard route protection.
 *
 * Next 16 renamed middleware -> proxy; apps/web/src/proxy.ts is the
 * middleware.ts the ticket asks for. These tests drive the real handler
 * with real NextRequest objects.
 *
 * JWT_SECRET is read at module scope inside @recheq/api's jwt.ts, so the
 * secret must be set before those modules are imported — hence the lazy
 * dynamic imports below instead of top-level static imports.
 */
const TEST_SECRET = 'proxy-test-secret';

let proxyFn: (request: NextRequest) => Promise<Response>;
let signToken: (payload: { userId: string; orgId: string; role: string }) => Promise<string>;

beforeAll(async () => {
  try {
    process.env.JWT_SECRET ??= TEST_SECRET;
    ({ proxy: proxyFn } = await import('../src/proxy.js'));
    ({ signToken } = await import('@recheq/api/src/security/jwt.js'));
  } catch (cause) {
    throw new Error(
      'proxy test setup failed: could not load proxy or jwt modules — ' +
        'check that JWT_SECRET is set and @recheq/api is built',
      { cause },
    );
  }
});

function req(path: string, sessionCookie?: string): NextRequest {
  const request = new NextRequest(new URL(`http://localhost${path}`));
  if (sessionCookie !== undefined) {
    request.cookies.set('recheq_session', sessionCookie);
  }
  return request;
}

async function expiredToken(): Promise<string> {
  const key = new TextEncoder().encode(process.env.JWT_SECRET ?? TEST_SECRET);
  return new SignJWT({ userId: 'u1', orgId: 'o1', role: 'candidate' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(key);
}

const clearsCookie = (response: Response): boolean =>
  response.headers
    .getSetCookie()
    .some(
      (c) =>
        c.startsWith('recheq_session=') &&
        (/Max-Age=0/i.test(c) || /Expires=Thu, 01 Jan 1970/i.test(c)),
    );

describe('RCQ-20110 — route protection proxy', () => {
  describe('R5.1 unauthenticated access to protected routes', () => {
    it('redirects GET /cases to /login?next=/cases with 307', async () => {
      const response = await proxyFn(req('/cases'));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location')!);
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('next')).toBe('/cases');
    });

    it('preserves deep path and query in the next parameter', async () => {
      const response = await proxyFn(req('/cases/abc123?tab=docs'));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location')!);
      expect(location.searchParams.get('next')).toBe('/cases/abc123?tab=docs');
    });

    it('protects /settings and /docs as well', async () => {
      for (const path of ['/settings', '/docs']) {
        const response = await proxyFn(req(path));
        expect(response.status).toBe(307);
        expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
      }
    });
  });

  describe('R5.2 token-authenticated routes bypass session middleware', () => {
    it('lets /c/<token> through with no session at all', async () => {
      const response = await proxyFn(req('/c/some-candidate-token'));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });

    it('lets /e/<token> through untouched', async () => {
      const response = await proxyFn(req('/e/some-employer-token'));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });

    it('still passes /c/<token> through even with a garbage cookie', async () => {
      const response = await proxyFn(req('/c/tok', 'not.a.jwt'));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      // Token routes are session-free: no cookie mutation may be emitted.
      expect(response.headers.getSetCookie()).toHaveLength(0);
    });
  });

  describe('R5.3 authenticated users on auth routes', () => {
    it('redirects /login to /cases by default', async () => {
      const token = await signToken({
        userId: 'u1',
        orgId: 'o1',
        role: 'ops',
      });
      const response = await proxyFn(req('/login', token));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('location')!).pathname).toBe('/cases');
    });

    it('honours a safe relative next parameter', async () => {
      const token = await signToken({
        userId: 'u1',
        orgId: 'o1',
        role: 'ops',
      });
      const response = await proxyFn(req('/login?next=/settings', token));
      expect(new URL(response.headers.get('location')!).pathname).toBe('/settings');
    });

    it('also redirects signed-in visitors away from signup', async () => {
      const token = await signToken({
        userId: 'u1',
        orgId: 'o1',
        role: 'ops',
      });
      const response = await proxyFn(req('/signup', token));
      expect(response.status).toBe(307);
    });
  });

  describe('open redirect hardening', () => {
    it.each([
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      '\\\\evil.com',
      'javascript:alert(1)',
      '/\n/evil.example',
      '/\r/evil.example',
      '/\t/evil.example',
    ])('ignores next=%j and falls back to /cases', async (next) => {
      const token = await signToken({
        userId: 'u1',
        orgId: 'o1',
        role: 'ops',
      });
      const response = await proxyFn(req(`/login?next=${encodeURIComponent(next)}`, token));
      const location = new URL(response.headers.get('location')!);
      expect(location.origin).toBe('http://localhost');
      expect(location.pathname).toBe('/cases');
    });

    it('exports a guard that rejects cross-host shapes only', async () => {
      const { isSafeRelativePath } = await import('../src/lib/safe-path.js');
      const bad = [
        'https://x.com',
        '//x.com',
        '/\\x.com',
        '\\x.com',
        '',
        '/\n/x.com',
        '/\r/x.com',
        '/\t/x.com',
      ];
      for (const path of bad) {
        expect(isSafeRelativePath(path)).toBe(false);
      }
      for (const good of ['/', '/cases', '/cases/1?x=2', '/settings#a']) {
        expect(isSafeRelativePath(good)).toBe(true);
      }
    });
  });

  describe('R5.4 expired or malformed sessions', () => {
    it('clears an expired cookie and redirects to /login', async () => {
      const token = await expiredToken();
      const response = await proxyFn(req('/cases', token));
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
      expect(clearsCookie(response)).toBe(true);
    });

    it.each([
      'garbage',
      'not.a.jwt',
      '{"userId":"u1"}',
      'a.b.c.d.e',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.tampered-signature',
    ])('never 500s on cookie %j — clears and redirects', async (bad) => {
      const response = await proxyFn(req('/settings', bad));
      expect(response.status).toBe(307);
      expect(clearsCookie(response)).toBe(true);
    });

    it('does not clear a valid session hitting protected routes', async () => {
      const token = await signToken({
        userId: 'u1',
        orgId: 'o1',
        role: 'ops',
      });
      const response = await proxyFn(req('/cases', token));
      expect(response.headers.getSetCookie()).toHaveLength(0);
    });
  });

  describe('matcher contract', () => {
    it('excludes api and static assets, includes pages', async () => {
      const { config } = await import('../src/proxy.js');
      // Next evaluates matchers anchored to the start of the path.
      const matcher = new RegExp(`^${config.matcher[0]}$`);

      expect(matcher.test('/api/cases')).toBe(false);
      expect(matcher.test('/api/public/tok/status')).toBe(false);
      expect(matcher.test('/_next/static/chunk.js')).toBe(false);
      expect(matcher.test('/_next/image?a=b')).toBe(false);
      expect(matcher.test('/favicon.ico')).toBe(false);
      expect(matcher.test('/sitemap.xml')).toBe(false);
      expect(matcher.test('/robots.txt')).toBe(false);

      expect(matcher.test('/cases')).toBe(true);
      expect(matcher.test('/login')).toBe(true);
      expect(matcher.test('/c/token')).toBe(true); // matched but passes through
      expect(matcher.test('/e/token')).toBe(true); // matched but passes through
    });
  });
});
