import Cookies from 'js-cookie';

export const AUTH_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

/**
 * Cookie options adhering to security best practices:
 * - SameSite: Lax (allows cookie on top-level navigations)
 * - Path: '/' (available app-wide)
 * - Secure: true in production (HTTPS only), false in development
 */
const getCookieOptions = (expiresInDays = 7): Cookies.CookieAttributes => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    expires: expiresInDays,
    path: '/',
    sameSite: 'lax',
    secure: isProduction,
  };
};

/**
 * Set the authentication token in browser cookie.
 */
export const setAuthCookie = (token: string, expiresInDays?: number): void => {
  if (typeof window === 'undefined') return;
  Cookies.set(AUTH_COOKIE_NAME, token, getCookieOptions(expiresInDays));
};

export const setRefreshTokenCookie = (token: string, expiresInDays: number = 7): void => {
  if (typeof window === 'undefined') return;
  Cookies.set(REFRESH_COOKIE_NAME, token, getCookieOptions(expiresInDays));
};

/**
 * Retrieve authentication token from browser cookie.
 */
export const getAuthCookie = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return Cookies.get(AUTH_COOKIE_NAME);
};

export const getRefreshTokenCookie = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return Cookies.get(REFRESH_COOKIE_NAME);
};

/**
 * Remove authentication token cookie upon logout or expired session.
 */
export const removeAuthCookie = (): void => {
  if (typeof window === 'undefined') return;
  Cookies.remove(AUTH_COOKIE_NAME, { path: '/' });
};

export const removeRefreshTokenCookie = (): void => {
  if (typeof window === 'undefined') return;
  Cookies.remove(REFRESH_COOKIE_NAME, { path: '/' });
};
