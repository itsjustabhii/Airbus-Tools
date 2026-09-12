"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
/**
 * Build a successful API response envelope.
 */
function successResponse(data, meta) {
    return { success: true, data, ...(meta !== undefined && { meta }) };
}
/**
 * Build an error API response envelope.
 */
function errorResponse(code, message, details) {
    return {
        success: false,
        error: { code, message, ...(details !== undefined && { details }) },
    };
}
//# sourceMappingURL=response.js.map