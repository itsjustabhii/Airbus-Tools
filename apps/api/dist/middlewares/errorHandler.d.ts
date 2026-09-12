import type { Request, Response, NextFunction } from 'express';
/**
 * Centralized error handling middleware.
 * Converts AppError and ZodError to standardized JSON responses.
 * Falls through unexpected errors as 500.
 */
export declare function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=errorHandler.d.ts.map