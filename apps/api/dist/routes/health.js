"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const shared_1 = require("@airbus-tools/shared");
const express_1 = require("express");
const response_1 = require("../core/response");
const router = (0, express_1.Router)();
exports.healthRouter = router;
/**
 * GET /health
 * Liveness probe — returns 200 if the process is running.
 */
router.get('/health', (_req, res) => {
    res.status(200).json((0, response_1.successResponse)({
        status: 'ok',
        app: shared_1.APP_NAME,
        version: shared_1.APP_VERSION,
        timestamp: new Date().toISOString(),
    }));
});
/**
 * GET /ready
 * Readiness probe — returns 200 when the app is ready to serve traffic.
 * Extend this to check DB / Redis connectivity as needed.
 */
router.get('/ready', (_req, res) => {
    res.status(200).json((0, response_1.successResponse)({ status: 'ready', timestamp: new Date().toISOString() }));
});
//# sourceMappingURL=health.js.map