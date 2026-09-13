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
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_\-]{1,64}$/;

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const existing = req.headers['x-request-id'];
  // Validate the caller-supplied header: allow only alphanumeric + safe punctuation,
  // max 64 chars. Reject anything that could inject characters into log lines.
  const isValidId =
    typeof existing === 'string' &&
    existing.length > 0 &&
    REQUEST_ID_PATTERN.test(existing);
  req.requestId = isValidId ? (existing as string) : uuidv4();
  next();
}
