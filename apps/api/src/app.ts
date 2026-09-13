import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';

import { config } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { csrfProtection } from './middlewares/csrf';
import { requestIdMiddleware } from './middlewares/requestId';
import { generalRateLimiter } from './middlewares/rateLimiter';
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

  // ── Trust proxy (for correct client IP behind load balancers in production) ─
  if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

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

  // ── CSRF protection (double-submit cookie) ───────────────────────────────────
  app.use(csrfProtection);

  // ── Global rate limiting ─────────────────────────────────────────────────────
  app.use(generalRateLimiter);

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

  // ── 404 handler ─────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // ── Centralized error handler ────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
