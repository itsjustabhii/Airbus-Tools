import type { Request, Response, NextFunction } from 'express';
export declare const CSRF_COOKIE_NAME = "csrf_token";
export declare const CSRF_HEADER_NAME = "x-csrf-token";
/**
 * Sets (or refreshes) the CSRF double-submit cookie.
 * Call this after a successful login/register response.
 */
export declare function setCsrfCookie(res: Response, isProduction: boolean): void;
/**
 * CSRF validation middleware.
 * Attach AFTER cookie-parser, BEFORE authenticate.
 */
export declare function csrfProtection(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=csrf.d.ts.map