import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const existing = req.headers['x-request-id'];
  req.requestId = typeof existing === 'string' && existing.length > 0 ? existing : uuidv4();
  next();
}
