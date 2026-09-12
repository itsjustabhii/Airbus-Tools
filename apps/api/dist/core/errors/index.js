"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.AppError = void 0;
const shared_1 = require("@airbus-tools/shared");
/**
 * Base application error class.
 */
class AppError extends Error {
    statusCode;
    code;
    details;
    isOperational;
    constructor(message, statusCode, code, details, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, shared_1.HTTP_STATUS.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', details);
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, shared_1.HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, shared_1.HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, shared_1.HTTP_STATUS.FORBIDDEN, 'FORBIDDEN');
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends AppError {
    constructor(message, details) {
        super(message, shared_1.HTTP_STATUS.CONFLICT, 'CONFLICT', details);
    }
}
exports.ConflictError = ConflictError;
//# sourceMappingURL=index.js.map