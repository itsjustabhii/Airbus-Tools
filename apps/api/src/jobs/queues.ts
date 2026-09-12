/**
 * BullMQ queue instances.
 *
 * All four queues share:
 *   - exponential back-off retry policy (3 attempts, 2 s base, ×2 factor)
 *   - job-ID derived from the caller-supplied `jobId` field for idempotency
 *   - 30-day retention for completed/failed jobs (for audit logging)
 *
 * Queues are singletons — call getQueue*() from any module without creating
 * duplicate connections.
 */
import { Queue, type DefaultJobOptions } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../config/env';
import { logger } from '../core/logger';

/** True when running under the test runner — queues become no-ops to avoid needing Redis. */
const IS_TEST = config.NODE_ENV === 'test';

import { bullMQConnection } from './redis';
import type {
  EmailJobData,
  EmailJobName,
  MaintenanceJobData,
  MaintenanceJobName,
  NotificationJobData,
  NotificationJobName,
  PaymentJobData,
  PaymentJobName,
} from './types';
import { QUEUE_NAMES } from './types';

// ── Shared defaults ───────────────────────────────────────────────────────────

/**
 * Default job options applied to every job unless overridden at enqueue time.
 *
 * Retry policy:
 *   attempt 1 → immediate
 *   attempt 2 → 2 s
 *   attempt 3 → 4 s
 *   (base 2_000 ms, exponential factor 2)
 */
const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2_000,
  },
  removeOnComplete: {
    // Keep last 500 completed jobs per queue for observability
    count: 500,
    // …but never older than 30 days
    age: 30 * 24 * 60 * 60,
  },
  removeOnFail: {
    // Keep last 200 failed jobs for debugging
    count: 200,
    age: 30 * 24 * 60 * 60,
  },
};

// ── Queue singletons ──────────────────────────────────────────────────────────

let emailQueue: Queue<EmailJobData, void, EmailJobName> | null = null;
let notificationsQueue: Queue<NotificationJobData, void, NotificationJobName> | null = null;
let paymentQueue: Queue<PaymentJobData, void, PaymentJobName> | null = null;
let maintenanceQueue: Queue<MaintenanceJobData, void, MaintenanceJobName> | null = null;

export function getEmailQueue(): Queue<EmailJobData, void, EmailJobName> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData, void, EmailJobName>(QUEUE_NAMES.EMAIL, {
      connection: bullMQConnection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    if (!IS_TEST) logger.info({ queue: QUEUE_NAMES.EMAIL }, '📬 Email queue initialized');
  }
  return emailQueue;
}

export function getNotificationsQueue(): Queue<NotificationJobData, void, NotificationJobName> {
  if (!notificationsQueue) {
    notificationsQueue = new Queue<NotificationJobData, void, NotificationJobName>(
      QUEUE_NAMES.NOTIFICATIONS,
      {
        connection: bullMQConnection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      },
    );
    if (!IS_TEST) logger.info({ queue: QUEUE_NAMES.NOTIFICATIONS }, '🔔 Notifications queue initialized');
  }
  return notificationsQueue;
}

export function getPaymentQueue(): Queue<PaymentJobData, void, PaymentJobName> {
  if (!paymentQueue) {
    paymentQueue = new Queue<PaymentJobData, void, PaymentJobName>(QUEUE_NAMES.PAYMENT, {
      connection: bullMQConnection,
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        // Payment jobs are higher-value — keep more history
        removeOnComplete: { count: 1_000, age: 90 * 24 * 60 * 60 },
        removeOnFail:    { count: 1_000, age: 90 * 24 * 60 * 60 },
      },
    });
    if (!IS_TEST) logger.info({ queue: QUEUE_NAMES.PAYMENT }, '💳 Payment queue initialized');
  }
  return paymentQueue;
}

export function getMaintenanceQueue(): Queue<MaintenanceJobData, void, MaintenanceJobName> {
  if (!maintenanceQueue) {
    maintenanceQueue = new Queue<MaintenanceJobData, void, MaintenanceJobName>(
      QUEUE_NAMES.MAINTENANCE,
      {
        connection: bullMQConnection,
        defaultJobOptions: {
          ...DEFAULT_JOB_OPTIONS,
          // Maintenance / scheduler jobs: only 1 attempt (they will be
          // re-scheduled on the next cron tick anyway)
          attempts: 1,
        },
      },
    );
    if (!IS_TEST) logger.info({ queue: QUEUE_NAMES.MAINTENANCE }, '🔧 Maintenance queue initialized');
  }
  return maintenanceQueue;
}

// ── Close all queues (called during graceful shutdown) ────────────────────────

export async function closeAllQueues(): Promise<void> {
  const queues = [emailQueue, notificationsQueue, paymentQueue, maintenanceQueue].filter(Boolean);

  await Promise.allSettled(queues.map((q) => q!.close()));
  emailQueue = null;
  notificationsQueue = null;
  paymentQueue = null;
  maintenanceQueue = null;

  logger.info('All BullMQ queues closed');
}

// ── Typed enqueue helpers ─────────────────────────────────────────────────────

/**
 * Generates a stable BullMQ job ID from the caller-supplied `jobId`.
 * Using the same `jobId` prevents duplicate jobs when a message is retried
 * at the HTTP layer before it reaches the queue (idempotency key pattern).
 */
function jobIdFromData(data: { jobId: string }): string {
  return data.jobId;
}

/** Generate a fresh job ID (UUID v4). */
export function newJobId(): string {
  return uuidv4();
}

/**
 * Enqueue an email job.
 * The `jobId` in `data` is used as the BullMQ job ID for deduplication.
 */
export async function enqueueEmail(
  data: EmailJobData,
  opts?: { delay?: number },
): Promise<void> {
  if (IS_TEST) return;
  const queue = getEmailQueue();
  const job = await queue.add(data.name as EmailJobName, data, {
    jobId: jobIdFromData(data),
    ...(opts?.delay !== undefined ? { delay: opts.delay } : {}),
  });
  logger.info(
    { queue: QUEUE_NAMES.EMAIL, jobId: job.id, name: data.name },
    'Email job enqueued',
  );
}

/**
 * Enqueue a notification job.
 */
export async function enqueueNotification(
  data: NotificationJobData,
  opts?: { delay?: number },
): Promise<void> {
  if (IS_TEST) return;
  const queue = getNotificationsQueue();
  const job = await queue.add(data.name as NotificationJobName, data, {
    jobId: jobIdFromData(data),
    ...(opts?.delay !== undefined ? { delay: opts.delay } : {}),
  });
  logger.info(
    { queue: QUEUE_NAMES.NOTIFICATIONS, jobId: job.id, name: data.name },
    'Notification job enqueued',
  );
}

/**
 * Enqueue a payment job.
 */
export async function enqueuePayment(
  data: PaymentJobData,
  opts?: { delay?: number; priority?: number },
): Promise<void> {
  if (IS_TEST) return;
  const queue = getPaymentQueue();
  const job = await queue.add(data.name as PaymentJobName, data, {
    jobId: jobIdFromData(data),
    ...(opts?.delay    !== undefined ? { delay: opts.delay } : {}),
    ...(opts?.priority !== undefined ? { priority: opts.priority } : {}),
  });
  logger.info(
    { queue: QUEUE_NAMES.PAYMENT, jobId: job.id, name: data.name },
    'Payment job enqueued',
  );
}

/**
 * Enqueue a maintenance job (typically called by the scheduler).
 */
export async function enqueueMaintenance(data: MaintenanceJobData): Promise<void> {
  if (IS_TEST) return;
  const queue = getMaintenanceQueue();
  const job = await queue.add(data.name as MaintenanceJobName, data, {
    jobId: jobIdFromData(data),
  });
  logger.info(
    { queue: QUEUE_NAMES.MAINTENANCE, jobId: job.id, name: data.name },
    'Maintenance job enqueued',
  );
}
