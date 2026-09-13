"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middlewares/errorHandler");
const requestId_1 = require("./middlewares/requestId");
const auth_1 = require("./routes/auth");
const health_1 = require("./routes/health");
const conversations_1 = require("./routes/conversations");
const orders_1 = require("./routes/orders");
const products_1 = require("./routes/products");
const profile_1 = require("./routes/profile");
const notifications_1 = require("./routes/notifications");
const recommendations_1 = require("./routes/recommendations");
const payments_1 = require("./routes/payments");
const upload_1 = require("./routes/upload");
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
    // NOTE: express.raw() for the payment webhook is applied per-route in
    // paymentsRouter to avoid buffering all requests.  express.json() runs
    // for every other route as normal.
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
    // ── Cookie parsing ──────────────────────────────────────────────────────────
    app.use((0, cookie_parser_1.default)(env_1.config.COOKIE_SECRET));
    // ── Request ID ──────────────────────────────────────────────────────────────
    app.use(requestId_1.requestIdMiddleware);
    // ── Routes ──────────────────────────────────────────────────────────────────
    app.use(health_1.healthRouter);
    app.use(env_1.config.API_PREFIX, health_1.healthRouter);
    app.use(`${env_1.config.API_PREFIX}/auth`, auth_1.authRouter);
    app.use(`${env_1.config.API_PREFIX}/profile`, profile_1.profileRouter);
    app.use(`${env_1.config.API_PREFIX}/uploads`, upload_1.uploadRouter);
    app.use(`${env_1.config.API_PREFIX}/products`, products_1.productsRouter);
    app.use(`${env_1.config.API_PREFIX}/recommendations`, recommendations_1.recommendationsRouter);
    app.use(`${env_1.config.API_PREFIX}/orders`, orders_1.ordersRouter);
    app.use(`${env_1.config.API_PREFIX}/payments`, payments_1.paymentsRouter);
    app.use(`${env_1.config.API_PREFIX}/conversations`, conversations_1.conversationsRouter);
    app.use(`${env_1.config.API_PREFIX}/notifications`, notifications_1.notificationsRouter);
    // Also support /api/* directly if prefix is /api/v1
    if (env_1.config.API_PREFIX !== '/api') {
        app.use('/api/auth', auth_1.authRouter);
        app.use('/api/profile', profile_1.profileRouter);
        app.use('/api/uploads', upload_1.uploadRouter);
        app.use('/api/products', products_1.productsRouter);
        app.use('/api/recommendations', recommendations_1.recommendationsRouter);
        app.use('/api/orders', orders_1.ordersRouter);
        app.use('/api/payments', payments_1.paymentsRouter);
        app.use('/api/conversations', conversations_1.conversationsRouter);
        app.use('/api/notifications', notifications_1.notificationsRouter);
    }
    // ── 404 handler ─────────────────────────────────────────────────────────────
    app.use((_req, res) => {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    });
    // ── Centralized error handler ────────────────────────────────────────────────
    app.use(errorHandler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map