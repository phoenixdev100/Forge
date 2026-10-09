import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env.js';
import { refreshTokenTtlMs } from '../../lib/tokens.js';

export const ACCESS_COOKIE = 'forge_at';
export const REFRESH_COOKIE = 'forge_rt';
/**
 * Readable-by-JS marker (value carries nothing sensitive). The client checks
 * for it before probing /auth/me, so anonymous visitors produce zero auth
 * requests instead of a pair of expected 401s.
 */
export const SESSION_HINT_COOKIE = 'forge_sess';

/**
 * Tokens live in httpOnly cookies so no XSS payload can read them. SameSite
 * stays `lax` for the common same-site deployment and only relaxes to `none`
 * (which requires Secure) when the API is on a different site.
 */
function baseOptions(maxAge: number): CookieOptions {
  const crossSite = env.COOKIE_CROSS_SITE;
  return {
    httpOnly: true,
    secure: crossSite || env.isProduction,
    sameSite: crossSite ? 'none' : 'lax',
    path: '/',
    maxAge,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

const ACCESS_MAX_AGE = 60 * 60 * 1000;

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, baseOptions(ACCESS_MAX_AGE));
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(refreshTokenTtlMs),
    path: '/api/auth',
  });
  res.cookie(SESSION_HINT_COOKIE, '1', { ...baseOptions(refreshTokenTtlMs), httpOnly: false });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(0), maxAge: undefined });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(0), maxAge: undefined, path: '/api/auth' });
  res.clearCookie(SESSION_HINT_COOKIE, { ...baseOptions(0), httpOnly: false, maxAge: undefined });
}
