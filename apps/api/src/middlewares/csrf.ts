/**
 * CSRF protection — Double-Submit Cookie pattern.
 *
 * On every authenticated response, a short-lived non-HttpOnly `csrf_token`
 * cookie is set with a random hex value.  For every state-changing request
 * (POST, PUT, PATCH, DELETE) the middleware verifies that the incoming
 * `X-CSRF-Token` header matches the cookie value via a timing-safe comparison.
 *
 * Why this works:
 *   - The CSRF cookie is readable by same-origin JavaScript but not by
 *     cross-origin pages (SOP prevents foreign origins from reading cookies).
 *   - A cross-site request cannot read the cookie value, so it cannot replay
 *     the matching header.
 *
 * Exempt paths:
 *   - GET, HEAD, OPTIONS (safe/idempotent methods)
 *   - The payment webhook (/webhook) which is validated by HMAC signature
 *   - Auth login/register (pre-session — no CSRF cookie exists yet)
 */
import { timingSafeEqual, randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** Methods that mutate state and therefore require CSRF validation. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Paths that are intentionally exempt from CSRF checks. */
const EXEMPT_PATH_PATTERNS = [
  /\/webhook$/,            // payment webhook — HMAC signature validated separately
  /\/api\/v1\/auth\/login$/,     // pre-session
  /\/api\/v1\/auth\/register$/,  // pre-session
  /\/api\/auth\/login$/,
  /\/api\/auth\/register$/,
];

function isExempt(path: string): boolean {
  return EXEMPT_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

/**
 * Sets (or refreshes) the CSRF double-submit cookie.
 * Call this after a successful login/register response.
 */
export function setCsrfCookie(res: Response, isProduction: boolean): void {
  const token = randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,           // must be readable by JS so the client can send the header
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
}

/**
 * CSRF validation middleware.
 * Attach AFTER cookie-parser, BEFORE authenticate.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Disabled in test environments to avoid test friction — CSRF is a browser concern.
  if (process.env['NODE_ENV'] === 'test') {
    return next();
  }

  // Only check state-changing methods
  if (!UNSAFE_METHODS.has(req.method)) {
    return next();
  }

  // Exempt paths
  if (isExempt(req.path)) {
    return next();
  }

  const cookieToken: string | undefined = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken || typeof headerToken !== 'string') {
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_VALIDATION_FAILED', message: 'CSRF token missing or invalid' },
    });
    return;
  }

  // Timing-safe comparison
  try {
    const cookieBuf = Buffer.from(cookieToken, 'utf8');
    const headerBuf = Buffer.from(headerToken, 'utf8');
    if (cookieBuf.length !== headerBuf.length || !timingSafeEqual(cookieBuf, headerBuf)) {
      throw new Error('mismatch');
    }
  } catch {
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_VALIDATION_FAILED', message: 'CSRF token missing or invalid' },
    });
    return;
  }

  next();
}
