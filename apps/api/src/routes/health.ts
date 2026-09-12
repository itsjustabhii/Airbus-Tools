import { APP_NAME, APP_VERSION } from '@airbus-tools/shared';
import type { Router } from 'express';
import { Router as createRouter } from 'express';

import { successResponse } from '../core/response';

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
 * Readiness probe — returns 200 when the app is ready to serve traffic.
 * Extend this to check DB / Redis connectivity as needed.
 */
router.get('/ready', (_req, res) => {
  res.status(200).json(successResponse({ status: 'ready', timestamp: new Date().toISOString() }));
});

export { router as healthRouter };
