"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const uuid_1 = require("uuid");
/**
 * Attaches a unique request ID to each incoming request.
 * Reads X-Request-ID header if present, otherwise generates a UUIDv4.
 */
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_\-]{1,64}$/;
function requestIdMiddleware(req, _res, next) {
    const existing = req.headers['x-request-id'];
    // Validate the caller-supplied header: allow only alphanumeric + safe punctuation,
    // max 64 chars. Reject anything that could inject characters into log lines.
    const isValidId = typeof existing === 'string' &&
        existing.length > 0 &&
        REQUEST_ID_PATTERN.test(existing);
    req.requestId = isValidId ? (existing) : (0, uuid_1.v4)();
    next();
}
//# sourceMappingURL=requestId.js.map