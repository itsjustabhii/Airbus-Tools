import type { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}
/**
 * Attaches a unique request ID to each incoming request.
 * Reads X-Request-ID header if present, otherwise generates a UUIDv4.
 */
export declare function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=requestId.d.ts.map