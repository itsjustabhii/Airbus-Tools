import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

import { config } from '../config/env';

const isTest = config.NODE_ENV === 'test';

/**
 * Strict rate limiter for auth endpoints (login, register).
 * 10 requests per 15 minutes per IP in production/development.
 * Disabled in test environments to avoid cross-test interference.
 */
export const authRateLimiter: RequestHandler = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      // In production, trust proxy so the real IP is used
      ...(config.NODE_ENV === 'production' && { trustProxy: 1 }),
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
          },
        });
      },
    });

/**
 * General API rate limiter — 100 requests per 15 minutes per IP.
 * Disabled in test environments.
 */
export const generalRateLimiter: RequestHandler = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
          },
        });
      },
    });
