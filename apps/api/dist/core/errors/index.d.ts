import { type ErrorCode } from '@airbus-tools/shared';
/**
 * Base application error class.
 */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: ErrorCode | string;
    readonly details?: unknown;
    readonly isOperational: boolean;
    constructor(message: string, statusCode: number, code: ErrorCode | string, details?: unknown, isOperational?: boolean);
}
export declare class ValidationError extends AppError {
    constructor(message: string, details?: unknown);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string, details?: unknown);
}
//# sourceMappingURL=index.d.ts.map