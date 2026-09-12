import type { Request, Response, NextFunction } from 'express';

import { ForbiddenError, UnauthorizedError } from '../core/errors';

/**
 * Role-based authorization middleware factory.
 * Must be used AFTER authenticate().
 *
 * @param allowedRoles - one or more roles that may access the route
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to access this resource'));
    }

    next();
  };
}
