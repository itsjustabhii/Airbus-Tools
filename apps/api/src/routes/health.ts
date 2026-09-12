import { APP_NAME, APP_VERSION } from '@airbus-tools/shared';
import type { Router } from 'express';
import { Router as createRouter } from 'express';

import { successResponse } from '../core/response';
import { database } from '../database/connection';


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

export { router as healthRouter };
