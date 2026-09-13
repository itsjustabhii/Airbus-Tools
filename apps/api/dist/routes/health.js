"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const shared_1 = require("@airbus-tools/shared");
const express_1 = require("express");
const response_1 = require("../core/response");
const connection_1 = require("../database/connection");
const queues_1 = require("../jobs/queues");
const types_1 = require("../jobs/types");
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
// ── GET /queues/health ────────────────────────────────────────────────────────
/**
 * Queue health endpoint — returns job counts for all four BullMQ queues.
 * Requires a live Redis connection; returns 503 if Redis is not available.
 */
router.get('/queues/health', (_req, res, next) => {
    void (async () => {
        try {
            const queueDefs = [
                { name: types_1.QUEUE_NAMES.EMAIL, fn: queues_1.getEmailQueue },
                { name: types_1.QUEUE_NAMES.NOTIFICATIONS, fn: queues_1.getNotificationsQueue },
                { name: types_1.QUEUE_NAMES.PAYMENT, fn: queues_1.getPaymentQueue },
                { name: types_1.QUEUE_NAMES.MAINTENANCE, fn: queues_1.getMaintenanceQueue },
            ];
            const queueStats = await Promise.all(queueDefs.map(async ({ name, fn }) => {
                try {
                    const queue = fn();
                    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
                    return { name, status: 'ok', counts };
                }
                catch (err) {
                    return {
                        name,
                        status: 'error',
                        error: err instanceof Error ? err.message : 'Unknown error',
                    };
                }
            }));
            const anyError = queueStats.some((q) => q.status === 'error');
            res.status(anyError ? 503 : 200).json((0, response_1.successResponse)({
                status: anyError ? 'degraded' : 'ok',
                timestamp: new Date().toISOString(),
                queues: queueStats,
            }));
        }
        catch (error) {
            next(error);
        }
    })();
});
//# sourceMappingURL=health.js.map