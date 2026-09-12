/**
 * Job scheduler.
 *
 * Registers BullMQ repeatable (cron) jobs for the four scheduled maintenance
 * tasks. Each job uses a deterministic `jobId` so that re-registering the same
 * cron (e.g. on worker restart) does NOT create duplicate schedules.
 *
 * Cron schedules (all UTC):
 *  - Expire stale orders:             every 30 minutes
 *  - Send pending reminders:          every hour at :05
 *  - Process pending notifications:   every 5 minutes
 *  - Reconcile pending payments:      every 15 minutes
 *
 * IMPORTANT: Scheduler setup must run inside the worker process, NOT inside the
 * HTTP server process, so that jobs are not enqueued from request handlers.
 */
import { v4 as uuidv4 } from 'uuid';

import { OrderStatus } from '@airbus-tools/shared';

import { logger } from '../core/logger';

import { getMaintenanceQueue } from './queues';
import type { MaintenanceJobData, MaintenanceJobName } from './types';

interface ScheduledJobDef {
  name: MaintenanceJobData['name'];
  cron: string;
  /** Deterministic key — prevents duplicate repeatable jobs across restarts */
  repeatJobKey: string;
  data: () => MaintenanceJobData;
}

const SCHEDULED_JOBS: ScheduledJobDef[] = [
  {
    name: 'expire-stale-orders',
    // Every 30 minutes
    cron: '*/30 * * * *',
    repeatJobKey: 'scheduled:expire-stale-orders',
    data: () => ({
      name: 'expire-stale-orders' as const,
      jobId: uuidv4(),
      // Expire orders pending for more than 72 hours
      olderThanISO: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    }),
  },
  {
    name: 'send-pending-reminders',
    // Every hour at minute 5
    cron: '5 * * * *',
    repeatJobKey: 'scheduled:send-pending-reminders',
    data: () => ({
      name: 'send-pending-reminders' as const,
      jobId: uuidv4(),
      targetStatuses: [
        OrderStatus.PENDING,
        OrderStatus.ACCEPTED,
        OrderStatus.PAYMENT_PENDING,
      ],
      reminderAfterHours: 24,
    }),
  },
  {
    name: 'process-pending-notifications',
    // Every 5 minutes
    cron: '*/5 * * * *',
    repeatJobKey: 'scheduled:process-pending-notifications',
    data: () => ({
      name: 'process-pending-notifications' as const,
      jobId: uuidv4(),
      batchSize: 100,
    }),
  },
  {
    name: 'reconcile-pending-payments',
    // Every 15 minutes
    cron: '*/15 * * * *',
    repeatJobKey: 'scheduled:reconcile-pending-payments',
    data: () => ({
      name: 'reconcile-pending-payments' as const,
      jobId: uuidv4(),
      batchSize: 50,
    }),
  },
];

/**
 * Register all recurring cron jobs in the maintenance queue.
 *
 * BullMQ deduplicates repeatable jobs by their `repeatJobKey` so calling this
 * function on every worker start is safe — no duplicate schedules are created.
 */
export async function setupScheduledJobs(): Promise<void> {
  // Cast to loose typing for the scheduler calls — the NameType generic is
  // MaintenanceJobName, but BullMQ's upsertJobScheduler also accepts a string
  // jobSchedulerId, so we use an any-typed alias here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: any = getMaintenanceQueue();

  for (const def of SCHEDULED_JOBS) {
    const jobData = def.data();
    const jobName = def.name as MaintenanceJobName;

    await queue.upsertJobScheduler(
      def.repeatJobKey,
      { pattern: def.cron },
      {
        name: jobName,
        data: jobData,
        opts: {
          // Maintenance jobs do not retry — the next cron tick will cover it
          attempts: 1,
          removeOnComplete: { count: 10 },
          removeOnFail:    { count: 10 },
        },
      },
    );

    logger.info(
      { name: def.name, cron: def.cron, repeatJobKey: def.repeatJobKey },
      `⏰ Scheduled job registered: ${def.name}`,
    );
  }

  logger.info(`✅ All ${SCHEDULED_JOBS.length} scheduled jobs registered`);
}

/**
 * Remove all registered cron schedules (used during graceful shutdown / tests).
 */
export async function teardownScheduledJobs(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: any = getMaintenanceQueue();

  for (const def of SCHEDULED_JOBS) {
    try {
      await queue.removeJobScheduler(def.repeatJobKey);
      logger.info({ repeatJobKey: def.repeatJobKey }, 'Scheduled job removed');
    } catch (err) {
      logger.warn({ err, repeatJobKey: def.repeatJobKey }, 'Failed to remove scheduled job (may not exist)');
    }
  }
}
