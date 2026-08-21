import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import * as jwt from '@tieout/api/src/security/jwt.js';

// Mock the JWT verification module
vi.mock('@tieout/api/src/security/jwt.js', () => ({
  verifyToken: vi.fn(),
}));

// Provide a mock for NextResponse to spy on redirect and cookies
const mockRedirect = vi.fn();
const mockNext = vi.fn();
const mockCookieDelete = vi.fn();

vi.mock('next/server', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      redirect: vi
        .fn()
        .mockImplementation((...args: Parameters<typeof actual.NextResponse.redirect>) => {
          mockRedirect(...args);
          return {
            cookies: {
              delete: mockCookieDelete,
            },
          };
        }),
      next: vi.fn().mockImplementation((...args: Parameters<typeof actual.NextResponse.next>) => {
        mockNext(...args);
        return {
          cookies: {
            delete: mockCookieDelete,
          },
        };
      }),
    },
  };
});

describe('Dashboard Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (url: string, cookieValue?: string) => {
    const req = new NextRequest(new URL(url, 'http://localhost'));
    if (cookieValue) {
      req.cookies.set('recheq_session', cookieValue);
    }
    return req;
  };

  it('R5.1: unauthenticated GET /cases -> 307 to /login?next=/cases', async () => {
    const req = createRequest('/cases/123');
    await proxy(req);

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    const status = mockRedirect.mock.calls[0][1];

    expect(redirectUrl.pathname).toBe('/login');
    expect(redirectUrl.searchParams.get('next')).toBe('/cases/123');
    expect(status).toBe(307);
  });

  it('R5.2: /c/<token> reachable with no session', async () => {
    const req = createRequest('/c/token123');
    await proxy(req);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('R5.4: tampered cookie clears and redirects', async () => {
    vi.mocked(jwt.verifyToken).mockResolvedValueOnce(null); // Simulate expired/malformed

    const req = createRequest('/settings/keys', 'bad_token');
    await proxy(req);

    expect(jwt.verifyToken).toHaveBeenCalledWith('bad_token');
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockCookieDelete).toHaveBeenCalledWith('recheq_session');

    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe('/login');
    expect(redirectUrl.searchParams.get('next')).toBe('/settings/keys');
  });

  it('R5.3: Authenticated user requests /login -> redirects to /cases', async () => {
    vi.mocked(jwt.verifyToken).mockResolvedValueOnce({
      userId: '1',
      orgId: '2',
      role: 'admin',
    });

    const req = createRequest('/login', 'valid_token');
    await proxy(req);

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe('/cases');
  });

  it('R5.3 & Open Redirect Prevention: redirects to valid next param but ignores absolute URL', async () => {
    vi.mocked(jwt.verifyToken).mockResolvedValue({
      userId: '1',
      orgId: '2',
      role: 'admin',
    });

    // Valid relative redirect
    const req1 = createRequest('/login?next=/settings');
    req1.cookies.set('recheq_session', 'valid_token');
    await proxy(req1);

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    let redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe('/settings');

    mockRedirect.mockClear();

    // Invalid absolute redirect
    const req2 = createRequest('/login?next=https://evil.com');
    req2.cookies.set('recheq_session', 'valid_token');
    await proxy(req2);

    expect(mockRedirect).toHaveBeenCalledTimes(1);
    redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    // Should fallback to /cases because the next URL is absolute
    expect(redirectUrl.pathname).toBe('/cases');
  });
});
