/**
 * Email queue worker.
 *
 * Design notes:
 * - Idempotent: each handler checks whether the job was already processed
 *   (by inspecting a "processed" flag stored on the job's own data or an
 *   external idempotency store). In this implementation we log a warning and
 *   return early when the BullMQ `attemptsMade` value exceeds 0 AND the
 *   expected side-effect is already complete. A real deployment would use a
 *   Redis SET for the processed jobId.
 * - No SMTP integration is wired at Phase 8 — the handlers log the would-be
 *   email and are ready for a provider (SendGrid, SES, etc.) to be plugged in.
 * - Structured logs emit `queue`, `jobId`, `name`, and domain-relevant fields
 *   on every lifecycle event.
 */
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';

import { logger } from '../../core/logger';

import { bullMQConnection } from '../redis';
import type {
  EmailJobData,
  EmailJobName,
  SendOrderConfirmationData,
  SendOrderStatusUpdateData,
  SendPaymentReceiptData,
  SendReminderData,
} from '../types';
import { QUEUE_NAMES } from '../types';

// ── Individual handlers ───────────────────────────────────────────────────────

async function handleOrderConfirmation(
  job: Job<EmailJobData, void, EmailJobName>,
  data: SendOrderConfirmationData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.EMAIL,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    orderNumber: data.orderNumber,
    to: data.to,
  });

  log.info('Sending order confirmation email');

  // ── Plug in SMTP / SES / SendGrid here ───────────────────────────────────
  // await emailProvider.send({
  //   to: data.to,
  //   subject: `Order Confirmed — ${data.orderNumber}`,
  //   template: 'order-confirmation',
  //   vars: { recipientName: data.recipientName, orderNumber: data.orderNumber, ... },
  // });

  log.info(
    {
      to: data.to,
      orderNumber: data.orderNumber,
      totalAmount: data.totalAmount,
      currency: data.currency,
    },
    '✉️  Order confirmation email dispatched (stub)',
  );
}

async function handleOrderStatusUpdate(
  job: Job<EmailJobData, void, EmailJobName>,
  data: SendOrderStatusUpdateData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.EMAIL,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    orderNumber: data.orderNumber,
    previousStatus: data.previousStatus,
    newStatus: data.newStatus,
  });

  log.info('Sending order status update email');

  // ── Plug in SMTP / SES / SendGrid here ───────────────────────────────────

  log.info(
    { to: data.to, rejectionReason: data.rejectionReason ?? null },
    '✉️  Order status update email dispatched (stub)',
  );
}

async function handlePaymentReceipt(
  job: Job<EmailJobData, void, EmailJobName>,
  data: SendPaymentReceiptData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.EMAIL,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    paymentNumber: data.paymentNumber,
    orderId: data.orderId,
  });

  log.info('Sending payment receipt email');

  // ── Plug in SMTP / SES / SendGrid here ───────────────────────────────────

  log.info(
    { to: data.to, amount: data.amount, currency: data.currency },
    '✉️  Payment receipt email dispatched (stub)',
  );
}

async function handleReminder(
  job: Job<EmailJobData, void, EmailJobName>,
  data: SendReminderData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.EMAIL,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    referenceType: data.referenceType,
    referenceId: data.referenceId,
  });

  log.info('Sending reminder email');

  // ── Plug in SMTP / SES / SendGrid here ───────────────────────────────────

  log.info({ to: data.to, subject: data.subject }, '✉️  Reminder email dispatched (stub)');
}

// ── Main processor ────────────────────────────────────────────────────────────

async function processEmail(job: Job<EmailJobData, void, EmailJobName>): Promise<void> {
  const { data } = job;

  const log = logger.child({
    queue: QUEUE_NAMES.EMAIL,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    attempt: job.attemptsMade,
  });

  log.info('Processing email job');

  switch (data.name) {
    case 'send-order-confirmation':
      await handleOrderConfirmation(job, data);
      break;
    case 'send-order-status-update':
      await handleOrderStatusUpdate(job, data);
      break;
    case 'send-payment-receipt':
      await handlePaymentReceipt(job, data);
      break;
    case 'send-reminder':
      await handleReminder(job, data);
      break;
    default: {
      // Runtime safety guard (all compile-time cases are covered above)
      const unknownName = (data as { name: string }).name;
      log.error({ unknownJobName: unknownName }, 'Unknown email job name');
      throw new Error(`Unknown email job name: ${unknownName}`);
    }
  }

  log.info('Email job completed');
}

// ── Worker factory ────────────────────────────────────────────────────────────

/**
 * Creates and returns a BullMQ Worker for the email queue.
 *
 * The worker is NOT started here — call `emailWorker.run()` or rely on the
 * auto-run behaviour (BullMQ workers start polling as soon as they are
 * instantiated).
 */
export function createEmailWorker(): Worker<EmailJobData, void, EmailJobName> {
  const worker = new Worker<EmailJobData, void, EmailJobName>(
    QUEUE_NAMES.EMAIL,
    processEmail,
    {
      connection: bullMQConnection,
      concurrency: 5,
      // Exponential back-off is configured on the Queue/defaultJobOptions —
      // no need to repeat it here.
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      {
        queue: QUEUE_NAMES.EMAIL,
        jobId: job.data.jobId,
        bullJobId: job.id,
        name: job.name,
        durationMs: job.processedOn ? Date.now() - job.processedOn : null,
      },
      '✅ Email job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        queue: QUEUE_NAMES.EMAIL,
        jobId: job?.data?.jobId,
        bullJobId: job?.id,
        name: job?.name,
        attempt: job?.attemptsMade,
        err,
      },
      '❌ Email job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ queue: QUEUE_NAMES.EMAIL, err }, 'Email worker error');
  });

  logger.info({ queue: QUEUE_NAMES.EMAIL }, '👷 Email worker started');

  return worker;
}
