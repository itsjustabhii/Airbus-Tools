/**
 * BullMQ background worker bootstrap stub.
 * Extend this file to register queues and processors.
 */
import { logger } from './core/logger';

logger.info('Worker process starting...');

// TODO (Phase 1+): Register BullMQ workers here
// Example:
// import { Worker } from 'bullmq';
// const worker = new Worker('my-queue', async (job) => { ... });

process.on('SIGTERM', () => {
  logger.info('Worker received SIGTERM, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Worker received SIGINT, shutting down');
  process.exit(0);
});
