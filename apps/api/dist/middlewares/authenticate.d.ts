import type { Request, Response, NextFunction } from 'express';
import { type JwtPayload } from '../auth/jwt';
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
export declare function authenticate(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=authenticate.d.ts.map