import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';

import { config } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { requestIdMiddleware } from './middlewares/requestId';
import { healthRouter } from './routes/health';

export function createApp(): Application {
  const app = express();

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // ── Body parsing ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Request ID ──────────────────────────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use(healthRouter);
  app.use(config.API_PREFIX, healthRouter);

  // ── 404 handler ─────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // ── Centralized error handler ────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
