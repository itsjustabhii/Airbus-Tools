import type { RequestHandler } from 'express';
/**
 * Strict rate limiter for auth endpoints (login, register).
 * 10 requests per 15 minutes per IP in production/development.
 * Disabled in test environments to avoid cross-test interference.
 */
export declare const authRateLimiter: RequestHandler;
/**
 * General API rate limiter — 100 requests per 15 minutes per IP.
 * Disabled in test environments.
 */
export declare const generalRateLimiter: RequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map