import type { ApiResponse, ApiErrorResponse, ApiMeta } from '@airbus-tools/shared';
/**
 * Build a successful API response envelope.
 */
export declare function successResponse<T>(data: T, meta?: ApiMeta): ApiResponse<T>;
/**
 * Build an error API response envelope.
 */
export declare function errorResponse(code: string, message: string, details?: unknown): ApiErrorResponse;
//# sourceMappingURL=response.d.ts.map