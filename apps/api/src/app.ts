import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';

import { config } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { requestIdMiddleware } from './middlewares/requestId';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { conversationsRouter } from './routes/conversations';
import { ordersRouter } from './routes/orders';
import { productsRouter } from './routes/products';
import { profileRouter } from './routes/profile';
import { notificationsRouter } from './routes/notifications';
import { recommendationsRouter } from './routes/recommendations';
import { paymentsRouter } from './routes/payments';
import { uploadRouter } from './routes/upload';

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
  // NOTE: express.raw() for the payment webhook is applied per-route in
  // paymentsRouter to avoid buffering all requests.  express.json() runs
  // for every other route as normal.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ── Cookie parsing ──────────────────────────────────────────────────────────
  app.use(cookieParser(config.COOKIE_SECRET));

  // ── Request ID ──────────────────────────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use(healthRouter);
  app.use(config.API_PREFIX, healthRouter);
  app.use(`${config.API_PREFIX}/auth`, authRouter);
  app.use(`${config.API_PREFIX}/profile`, profileRouter);
  app.use(`${config.API_PREFIX}/uploads`, uploadRouter);
  app.use(`${config.API_PREFIX}/products`, productsRouter);
  app.use(`${config.API_PREFIX}/recommendations`, recommendationsRouter);
  app.use(`${config.API_PREFIX}/orders`, ordersRouter);
  app.use(`${config.API_PREFIX}/payments`, paymentsRouter);
  app.use(`${config.API_PREFIX}/conversations`, conversationsRouter);
  app.use(`${config.API_PREFIX}/notifications`, notificationsRouter);

  // Also support /api/* directly if prefix is /api/v1
  if (config.API_PREFIX !== '/api') {
    app.use('/api/auth', authRouter);
    app.use('/api/profile', profileRouter);
    app.use('/api/uploads', uploadRouter);
    app.use('/api/products', productsRouter);
    app.use('/api/recommendations', recommendationsRouter);
    app.use('/api/orders', ordersRouter);
    app.use('/api/payments', paymentsRouter);
    app.use('/api/conversations', conversationsRouter);
    app.use('/api/notifications', notificationsRouter);
  }

  // ── 404 handler ─────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // ── Centralized error handler ────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
