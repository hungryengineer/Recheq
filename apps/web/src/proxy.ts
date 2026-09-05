import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@recheq/api/src/security/jwt.js';
import { isSafeRelativePath } from '@/lib/safe-path';

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // R5.2 - Excluded paths (already excluded by matcher, but /c/** and /e/** explicitly mentioned)
  if (pathname.startsWith('/c/') || pathname.startsWith('/e/')) {
    return NextResponse.next();
  }

  const isProtectedRoute =
    pathname.startsWith('/cases') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/docs');

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password');

  const sessionCookie = request.cookies.get('recheq_session');
  let isValidSession = false;

  if (sessionCookie?.value) {
    // Validate JWT token
    const payload = await verifyToken(sessionCookie.value);
    if (payload) {
      isValidSession = true;
    }
  }

  // R5.1 & R5.4 - Protected routes without valid session
  if (isProtectedRoute && !isValidSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + request.nextUrl.search);
    const response = NextResponse.redirect(url, 307);

    // R5.4 - clear invalid cookie
    if (sessionCookie?.value && !isValidSession) {
      response.cookies.delete('recheq_session');
    }

    return response;
  }

  // R5.3 - Auth routes with valid session
  if (isAuthRoute && isValidSession) {
    const nextUrl = searchParams.get('next');
    // Security: Only redirect to relative paths to prevent open redirect.
    // Reject protocol-relative ('//host') and backslash variants ('/\host',
    // '\host') which URL parsers normalize into cross-host references.
    if (nextUrl && isSafeRelativePath(nextUrl)) {
      return NextResponse.redirect(new URL(nextUrl, request.url));
    }
    return NextResponse.redirect(new URL('/cases', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (static files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
