import type { Request, Response, NextFunction } from 'express';
/**
 * Role-based authorization middleware factory.
 * Must be used AFTER authenticate().
 *
 * @param allowedRoles - one or more roles that may access the route
 */
export declare function authorize(...allowedRoles: string[]): (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=authorize.d.ts.map