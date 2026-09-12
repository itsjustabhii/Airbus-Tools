"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const uuid_1 = require("uuid");
/**
 * Attaches a unique request ID to each incoming request.
 * Reads X-Request-ID header if present, otherwise generates a UUIDv4.
 */
function requestIdMiddleware(req, _res, next) {
    const existing = req.headers['x-request-id'];
    req.requestId = typeof existing === 'string' && existing.length > 0 ? existing : (0, uuid_1.v4)();
    next();
}
//# sourceMappingURL=requestId.js.map