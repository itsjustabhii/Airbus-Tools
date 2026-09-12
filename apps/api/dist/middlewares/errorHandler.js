"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const index_1 = require("../core/errors/index");
const logger_1 = require("../core/logger");
const response_1 = require("../core/response");
/**
 * Centralized error handling middleware.
 * Converts AppError and ZodError to standardized JSON responses.
 * Falls through unexpected errors as 500.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function errorHandler(err, req, res, _next) {
    if (err instanceof index_1.AppError && err.isOperational) {
        res.status(err.statusCode).json((0, response_1.errorResponse)(err.code, err.message, err.details));
        return;
    }
    if (err instanceof zod_1.ZodError) {
        const details = err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
        res
            .status(422)
            .json((0, response_1.errorResponse)('VALIDATION_ERROR', 'Request validation failed', details));
        return;
    }
    // Unknown / programmer errors — log the stack trace
    logger_1.logger.error({ err, requestId: req.requestId }, 'Unhandled error');
    res.status(500).json((0, response_1.errorResponse)('INTERNAL_ERROR', 'An unexpected error occurred'));
}
//# sourceMappingURL=errorHandler.js.map