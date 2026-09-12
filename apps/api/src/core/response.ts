import type { ApiResponse, ApiErrorResponse, ApiMeta } from '@airbus-tools/shared';

/**
 * Build a successful API response envelope.
 */
export function successResponse<T>(data: T, meta?: ApiMeta): ApiResponse<T> {
  return { success: true, data, ...(meta !== undefined && { meta }) };
}

/**
 * Build an error API response envelope.
 */
export function errorResponse(
  code: string,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  return {
    success: false,
    error: { code, message, ...(details !== undefined && { details }) },
  };
}
