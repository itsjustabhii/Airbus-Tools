/**
 * Worker process entry point — Phase 8: Asynchronous Jobs
 *
 * This file is the ONLY entry point for background job processing.
 * It must NEVER be imported by the HTTP server (server.ts / app.ts).
 *
 * Startup sequence:
 *  1. Connect to MongoDB (workers need DB access for job handlers)
 *  2. Register all four BullMQ workers (email, notifications, payment, maintenance)
 *  3. Register scheduled (cron) jobs via the scheduler
 *
 * Graceful shutdown (SIGTERM / SIGINT):
 *  1. Stop all workers from picking up new jobs (`worker.pause()`)
 *  2. Wait for in-progress jobs to complete (up to 15 s)
 *  3. Close all workers
 *  4. Close all queues
 *  5. Disconnect from MongoDB
 */
import type { Worker } from 'bullmq';

import { config } from './config/env';
import { logger } from './core/logger';
import { database } from './database/connection';
import { closeAllQueues } from './jobs/queues';
import { setupScheduledJobs, teardownScheduledJobs } from './jobs/scheduler';
import { createEmailWorker } from './jobs/workers/emailWorker';
import { createMaintenanceWorker } from './jobs/workers/maintenanceWorker';
import { createNotificationsWorker } from './jobs/workers/notificationsWorker';
import { createPaymentWorker } from './jobs/workers/paymentWorker';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

// Use a loose array type — each worker is typed separately when pushed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workers: Worker<any, any, any>[] = [];

async function bootstrap(): Promise<void> {
  logger.info('🚀 Worker process starting…');

  // 1. Connect to MongoDB
  await database.connect({ uri: config.MONGODB_URI });
  logger.info('📦 Worker process connected to MongoDB');

  // 2. Register workers (each factory starts polling immediately)
  workers.push(
    createEmailWorker(),
    createNotificationsWorker(),
    createPaymentWorker(),
    createMaintenanceWorker(),
  );

  logger.info(`👷 ${workers.length} workers registered and polling`);

  // 3. Register scheduled cron jobs
  await setupScheduledJobs();
  logger.info('⏰ Scheduled jobs registered');

  logger.info('✅ Worker process ready');
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Worker process received shutdown signal — starting graceful shutdown…');

  const forceTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 15 s — forcing exit');
    process.exit(1);
  }, 15_000);

  try {
    // Step 1: Remove cron schedules so they do not fire during shutdown
    await teardownScheduledJobs();

    // Step 2: Pause all workers (stop accepting new jobs from the queue)
    await Promise.allSettled(workers.map((w) => w.pause()));
    logger.info('All workers paused');

    // Step 3: Wait for in-progress jobs to finish (BullMQ drains when closed)
    await Promise.allSettled(workers.map((w) => w.close()));
    logger.info('All workers closed');

    // Step 4: Close queue connections
    await closeAllQueues();
    logger.info('All queues closed');

    // Step 5: Disconnect MongoDB
    await database.disconnect();
    logger.info('MongoDB disconnected');

    clearTimeout(forceTimeout);
    logger.info('✅ Worker process graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during worker graceful shutdown');
    clearTimeout(forceTimeout);
    process.exit(1);
  }
}

// ── Signal handlers ───────────────────────────────────────────────────────────

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception in worker process — shutting down');
  void shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection in worker process — shutting down');
  void shutdown('unhandledRejection');
});

// ── Start ─────────────────────────────────────────────────────────────────────

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Worker bootstrap failed');
  process.exit(1);
});
