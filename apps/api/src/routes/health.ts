import { APP_NAME, APP_VERSION } from '@airbus-tools/shared';
import type { Router } from 'express';
import { Router as createRouter } from 'express';

import { successResponse } from '../core/response';
import { database } from '../database/connection';
import {
  getEmailQueue,
  getMaintenanceQueue,
  getNotificationsQueue,
  getPaymentQueue,
} from '../jobs/queues';
import { QUEUE_NAMES } from '../jobs/types';


const router: Router = createRouter();

/**
 * GET /health
 * Liveness probe — returns 200 if the process is running.
 */
router.get('/health', (_req, res) => {
  res.status(200).json(
    successResponse({
      status: 'ok',
      app: APP_NAME,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    }),
  );
});

/**
 * GET /ready
 * Readiness probe — checks DB connectivity and returns health metrics.
 */
router.get('/ready', (_req, res, next) => {
  void (async () => {
    try {
      const dbHealth = await database.getHealthStatus();
      const isHealthy = dbHealth.status === 'healthy' || dbHealth.status === 'degraded';

      const statusCode = isHealthy ? 200 : 503;
      res.status(statusCode).json(
        successResponse({
          status: isHealthy ? 'ready' : 'not_ready',
          timestamp: new Date().toISOString(),
          services: {
            database: dbHealth,
          },
        }),
      );
    } catch (error) {
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
        { name: QUEUE_NAMES.EMAIL,         fn: getEmailQueue },
        { name: QUEUE_NAMES.NOTIFICATIONS, fn: getNotificationsQueue },
        { name: QUEUE_NAMES.PAYMENT,       fn: getPaymentQueue },
        { name: QUEUE_NAMES.MAINTENANCE,   fn: getMaintenanceQueue },
      ] as const;

      const queueStats = await Promise.all(
        queueDefs.map(async ({ name, fn }) => {
          try {
            const queue = fn();
            const counts = await queue.getJobCounts(
              'waiting',
              'active',
              'completed',
              'failed',
              'delayed',
            );
            return { name, status: 'ok', counts };
          } catch (err) {
            return {
              name,
              status: 'error',
              error: err instanceof Error ? err.message : 'Unknown error',
            };
          }
        }),
      );

      const anyError = queueStats.some((q) => q.status === 'error');

      res.status(anyError ? 503 : 200).json(
        successResponse({
          status: anyError ? 'degraded' : 'ok',
          timestamp: new Date().toISOString(),
          queues: queueStats,
        }),
      );
    } catch (error) {
      next(error);
    }
  })();
});

export { router as healthRouter };
