"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalRateLimiter = exports.authRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
const isTest = env_1.config.NODE_ENV === 'test';
/**
 * Strict rate limiter for auth endpoints (login, register).
 * 10 requests per 15 minutes per IP in production/development.
 * Disabled in test environments to avoid cross-test interference.
 */
exports.authRateLimiter = isTest
    ? (_req, _res, next) => next()
    : (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        // trust proxy is set at the Express app level (app.set('trust proxy', 1)) — not here
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
exports.generalRateLimiter = isTest
    ? (_req, _res, next) => next()
    : (0, express_rate_limit_1.default)({
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
//# sourceMappingURL=rateLimiter.js.map