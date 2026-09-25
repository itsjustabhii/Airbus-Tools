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
    // Omit app version to avoid fingerprinting — expose status and timestamp only
    res.status(200).json((0, response_1.successResponse)({
        status: 'ok',
        app: shared_1.APP_NAME,
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
            // Strip host/port/name from the public response to avoid infrastructure fingerprinting.
            res.status(statusCode).json((0, response_1.successResponse)({
                status: isHealthy ? 'ready' : 'not_ready',
                timestamp: new Date().toISOString(),
                services: {
                    database: {
                        status: dbHealth.status,
                        state: dbHealth.state,
                        pingTimeMs: dbHealth.pingTimeMs,
                    },
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
/**
 * GET /queues/health
 * Returns aggregate queue health (up/degraded/down) without exposing
 * internal queue names, job counts, or raw error messages.
 * Intended for internal monitoring systems; restrict access via network policy.
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
                    await queue.getJobCounts('waiting', 'active', 'failed');
                    return { name, status: 'ok' };
                }
                catch {
                    // Omit error details — they may contain internal paths or queue config
                    return { name, status: 'error' };
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