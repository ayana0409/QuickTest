import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'access_token';

// Protected routes requiring authentication
const PROTECTED_PREFIXES = ['/admin', '/teacher', '/student', '/profile'];

// Guest-only auth routes
const AUTH_ROUTES = ['/login', '/register'];

/**
 * Next.js Edge Middleware for Server-side Route Protection.
 * Reads the 'access_token' cookie to enforce authentication boundaries before page rendering.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(token && token.trim().length > 0);

  // 1. Check if user is accessing protected routes without valid token
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    const callbackUrl = `${pathname}${search}`;
    loginUrl.searchParams.set('callbackUrl', callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Auth routes (/login, /register):
  // If user already has a valid token and there is a callbackUrl, send them straight to callbackUrl
  if (AUTH_ROUTES.includes(pathname) && isAuthenticated) {
    const rawCallback =
      request.nextUrl.searchParams.get('callbackUrl') ||
      request.nextUrl.searchParams.get('redirect');

    if (
      rawCallback &&
      rawCallback.startsWith('/') &&
      !rawCallback.startsWith('/login') &&
      !rawCallback.startsWith('/register')
    ) {
      return NextResponse.redirect(new URL(rawCallback, request.url));
    }
  }

  return NextResponse.next();
}

/**
 * Configure paths that trigger this middleware.
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/teacher/:path*',
    '/student/:path*',
    '/profile/:path*',
    '/profile',
    '/exam/:path*',
    '/login',
    '/register',
  ],
};
