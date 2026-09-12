"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const shared_1 = require("@airbus-tools/shared");
const express_1 = require("express");
const response_1 = require("../core/response");
const connection_1 = require("../database/connection");
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
 * Readiness probe — checks DB connectivity and returns health metrics.
 */
router.get('/ready', (_req, res, next) => {
    void (async () => {
        try {
            const dbHealth = await connection_1.database.getHealthStatus();
            const isHealthy = dbHealth.status === 'healthy' || dbHealth.status === 'degraded';
            const statusCode = isHealthy ? 200 : 503;
            res.status(statusCode).json((0, response_1.successResponse)({
                status: isHealthy ? 'ready' : 'not_ready',
                timestamp: new Date().toISOString(),
                services: {
                    database: dbHealth,
                },
            }));
        }
        catch (error) {
            next(error);
        }
    })();
});
//# sourceMappingURL=health.js.map