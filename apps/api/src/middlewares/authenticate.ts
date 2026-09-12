import type { Request, Response, NextFunction } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import { UnauthorizedError } from '../core/errors';
import { AUTH_COOKIE_NAME } from '../auth/service';
import { verifyToken, type JwtPayload } from '../auth/jwt';

// Augment Express Request to carry the authenticated principal
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Reads the JWT from the HttpOnly cookie, verifies it, and attaches the
 * decoded payload to req.user. Throws UnauthorizedError for any failure.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return next(new UnauthorizedError('Token has expired'));
    }
    if (err instanceof JsonWebTokenError) {
      return next(new UnauthorizedError('Invalid token'));
    }
    next(err);
  }
}
