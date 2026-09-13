import { APP_NAME } from '@airbus-tools/shared';
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
  // Omit app version to avoid fingerprinting — expose status and timestamp only
  res.status(200).json(
    successResponse({
      status: 'ok',
      app: APP_NAME,
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
      // Strip host/port/name from the public response to avoid infrastructure fingerprinting.
      res.status(statusCode).json(
        successResponse({
          status: isHealthy ? 'ready' : 'not_ready',
          timestamp: new Date().toISOString(),
          services: {
            database: {
              status: dbHealth.status,
              state: dbHealth.state,
              pingTimeMs: dbHealth.pingTimeMs,
            },
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
        { name: QUEUE_NAMES.EMAIL,         fn: getEmailQueue },
        { name: QUEUE_NAMES.NOTIFICATIONS, fn: getNotificationsQueue },
        { name: QUEUE_NAMES.PAYMENT,       fn: getPaymentQueue },
        { name: QUEUE_NAMES.MAINTENANCE,   fn: getMaintenanceQueue },
      ] as const;

      const queueStats = await Promise.all(
        queueDefs.map(async ({ name, fn }) => {
          try {
            const queue = fn();
            await queue.getJobCounts('waiting', 'active', 'failed');
            return { name, status: 'ok' };
          } catch {
            // Omit error details — they may contain internal paths or queue config
            return { name, status: 'error' };
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
