"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middlewares/errorHandler");
const requestId_1 = require("./middlewares/requestId");
const health_1 = require("./routes/health");
function createApp() {
    const app = (0, express_1.default)();
    // ── Security headers ────────────────────────────────────────────────────────
    app.use((0, helmet_1.default)());
    // ── CORS ────────────────────────────────────────────────────────────────────
    app.use((0, cors_1.default)({
        origin: env_1.config.CORS_ORIGIN,
        credentials: true,
    }));
    // ── Body parsing ────────────────────────────────────────────────────────────
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
    // ── Request ID ──────────────────────────────────────────────────────────────
    app.use(requestId_1.requestIdMiddleware);
    // ── Routes ──────────────────────────────────────────────────────────────────
    app.use(health_1.healthRouter);
    app.use(env_1.config.API_PREFIX, health_1.healthRouter);
    // ── 404 handler ─────────────────────────────────────────────────────────────
    app.use((_req, res) => {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    });
    // ── Centralized error handler ────────────────────────────────────────────────
    app.use(errorHandler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map