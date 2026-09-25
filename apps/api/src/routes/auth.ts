import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';

import { registerSchema, loginSchema, changePasswordSchema } from '../auth/schemas';
import {
  registerUser,
  loginUser,
  getMe,
  changePassword,
  AUTH_COOKIE_NAME,
} from '../auth/service';
import { config } from '../config/env';
import { successResponse } from '../core/response';
import { authenticate } from '../middlewares/authenticate';
import { setCsrfCookie } from '../middlewares/csrf';
import { authRateLimiter } from '../middlewares/rateLimiter';

const router: Router = createRouter();

// Cookie options shared by login/register (sets cookie) and logout (clears cookie)
function cookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}

/**
 * POST /api/auth/register
 * Creates a new user (AIRLINE or SUPPLIER only) and returns a session cookie.
 */
router.post('/register', authRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const input = registerSchema.parse(req.body);
      const { token, user } = await registerUser(input);

      const isProd = config.NODE_ENV === 'production';
      setCsrfCookie(res, isProd);
      res
        .cookie(AUTH_COOKIE_NAME, token, cookieOptions(isProd))
        .status(201)
        .json(successResponse({ user }));
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * POST /api/auth/login
 * Authenticates credentials and sets a session cookie.
 */
router.post('/login', authRateLimiter, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const input = loginSchema.parse(req.body);
      const { token, user } = await loginUser(input);

      const isProd = config.NODE_ENV === 'production';
      setCsrfCookie(res, isProd);
      res
        .cookie(AUTH_COOKIE_NAME, token, cookieOptions(isProd))
        .status(200)
        .json(successResponse({ user }));
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
router.post('/logout', authenticate, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      // Revoke the current JWT so it cannot be reused even within its expiry window
      if (req.user?.jti) {
        const { revokeToken } = await import('../auth/tokenRevocation');
        const { tokenRemainingTtl } = await import('../auth/jwt');
        await revokeToken(req.user.jti, tokenRemainingTtl(req.user));
      }
      const isProd = config.NODE_ENV === 'production';
      res
        .clearCookie(AUTH_COOKIE_NAME, cookieOptions(isProd))
        .status(200)
        .json(successResponse({ message: 'Logged out successfully' }));
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile (no passwordHash).
 */
router.get('/me', authenticate, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const user = await getMe(req.user!.sub);
      res.status(200).json(successResponse({ user }));
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * PATCH /api/auth/password
 * Changes the authenticated user's password.
 */
router.patch('/password', authenticate, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const input = changePasswordSchema.parse(req.body);
      await changePassword(req.user!.sub, input);

      // Revoke the current token so sessions on other devices are invalidated
      if (req.user?.jti) {
        const { revokeToken } = await import('../auth/tokenRevocation');
        const { tokenRemainingTtl } = await import('../auth/jwt');
        await revokeToken(req.user.jti, tokenRemainingTtl(req.user));
      }

      res.status(200).json(successResponse({ message: 'Password updated successfully' }));
    } catch (err) {
      next(err);
    }
  })();
});

export { router as authRouter };
