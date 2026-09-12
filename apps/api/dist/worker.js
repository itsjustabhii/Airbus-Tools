"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * BullMQ background worker bootstrap stub.
 * Extend this file to register queues and processors.
 */
const logger_1 = require("./core/logger");
logger_1.logger.info('Worker process starting...');
// TODO (Phase 1+): Register BullMQ workers here
// Example:
// import { Worker } from 'bullmq';
// const worker = new Worker('my-queue', async (job) => { ... });
process.on('SIGTERM', () => {
    logger_1.logger.info('Worker received SIGTERM, shutting down');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.logger.info('Worker received SIGINT, shutting down');
    process.exit(0);
});
//# sourceMappingURL=worker.js.map