import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../core/errors/index';
import { logger } from '../core/logger';
import { errorResponse } from '../core/response';

/**
 * Centralized error handling middleware.
 * Converts AppError and ZodError to standardized JSON responses.
 * Falls through unexpected errors as 500.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json(errorResponse(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
    res
      .status(422)
      .json(errorResponse('VALIDATION_ERROR', 'Request validation failed', details));
    return;
  }

  // Unknown / programmer errors — log the stack trace
  logger.error({ err, requestId: req.requestId }, 'Unhandled error');
  res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
}
