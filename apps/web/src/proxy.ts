import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected dashboard routes
  const isProtectedRoute =
    pathname.startsWith('/cases') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/docs');

  // Authentication routes (should not be accessed if already logged in)
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup');

  // Verify session existence via cookie
  const session = request.cookies.get('recheq_session');

  // 1. Unauthenticated users trying to access protected routes
  if (isProtectedRoute && !session) {
    const url = new URL('/login', request.url);
    // Optional: add a callback URL to return the user to their intended destination
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // 2. Authenticated users trying to access auth pages (login/signup)
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/cases', request.url));
  }

  // Allow the request to proceed normally
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
