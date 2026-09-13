"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const logger_1 = require("./core/logger");
const connection_1 = require("./database/connection");
const queues_1 = require("./jobs/queues");
const scheduler_1 = require("./jobs/scheduler");
const emailWorker_1 = require("./jobs/workers/emailWorker");
const maintenanceWorker_1 = require("./jobs/workers/maintenanceWorker");
const notificationsWorker_1 = require("./jobs/workers/notificationsWorker");
const paymentWorker_1 = require("./jobs/workers/paymentWorker");
// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Use a loose array type — each worker is typed separately when pushed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workers = [];
async function bootstrap() {
    logger_1.logger.info('🚀 Worker process starting…');
    // 1. Connect to MongoDB
    await connection_1.database.connect({ uri: env_1.config.MONGODB_URI });
    logger_1.logger.info('📦 Worker process connected to MongoDB');
    // 2. Register workers (each factory starts polling immediately)
    workers.push((0, emailWorker_1.createEmailWorker)(), (0, notificationsWorker_1.createNotificationsWorker)(), (0, paymentWorker_1.createPaymentWorker)(), (0, maintenanceWorker_1.createMaintenanceWorker)());
    logger_1.logger.info(`👷 ${workers.length} workers registered and polling`);
    // 3. Register scheduled cron jobs
    await (0, scheduler_1.setupScheduledJobs)();
    logger_1.logger.info('⏰ Scheduled jobs registered');
    logger_1.logger.info('✅ Worker process ready');
}
// ── Graceful shutdown ─────────────────────────────────────────────────────────
let isShuttingDown = false;
async function shutdown(signal) {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    logger_1.logger.info({ signal }, 'Worker process received shutdown signal — starting graceful shutdown…');
    const forceTimeout = setTimeout(() => {
        logger_1.logger.error('Graceful shutdown timed out after 15 s — forcing exit');
        process.exit(1);
    }, 15_000);
    try {
        // Step 1: Remove cron schedules so they do not fire during shutdown
        await (0, scheduler_1.teardownScheduledJobs)();
        // Step 2: Pause all workers (stop accepting new jobs from the queue)
        await Promise.allSettled(workers.map((w) => w.pause()));
        logger_1.logger.info('All workers paused');
        // Step 3: Wait for in-progress jobs to finish (BullMQ drains when closed)
        await Promise.allSettled(workers.map((w) => w.close()));
        logger_1.logger.info('All workers closed');
        // Step 4: Close queue connections
        await (0, queues_1.closeAllQueues)();
        logger_1.logger.info('All queues closed');
        // Step 5: Disconnect MongoDB
        await connection_1.database.disconnect();
        logger_1.logger.info('MongoDB disconnected');
        clearTimeout(forceTimeout);
        logger_1.logger.info('✅ Worker process graceful shutdown complete');
        process.exit(0);
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Error during worker graceful shutdown');
        clearTimeout(forceTimeout);
        process.exit(1);
    }
}
// ── Signal handlers ───────────────────────────────────────────────────────────
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
    logger_1.logger.fatal({ err }, 'Uncaught exception in worker process — shutting down');
    void shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    logger_1.logger.fatal({ reason }, 'Unhandled rejection in worker process — shutting down');
    void shutdown('unhandledRejection');
});
// ── Start ─────────────────────────────────────────────────────────────────────
bootstrap().catch((err) => {
    logger_1.logger.fatal({ err }, 'Worker bootstrap failed');
    process.exit(1);
});
//# sourceMappingURL=worker.js.map