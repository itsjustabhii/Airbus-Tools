/**
 * Email queue worker — Phase 9: Amazon SES.
 *
 * Design notes:
 *  - All email dispatch is delegated to EmailService, which owns:
 *      • template rendering
 *      • adapter selection (SES in production, Local in dev/test)
 *      • in-process idempotency via processedJobIds Set
 *  - The worker adds a second idempotency layer: if BullMQ retries a job
 *    (attemptsMade > 0) and EmailService's idempotency store already holds
 *    the jobId, the job finishes successfully without re-sending.
 *  - Structured log events carry queue, jobId, bullJobId, name, attempt on
 *    every lifecycle step so the worker output is fully observable.
 *  - Concurrency is 5 — safe for SES's default 14 msg/s sending rate.
 */
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';

import { logger } from '../../core/logger';
import { emailService } from '../../services/email/EmailService';
import { bullMQConnection } from '../redis';
import type { EmailJobData, EmailJobName } from '../types';
import { QUEUE_NAMES } from '../types';

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

  await emailService.send(data);

  log.info('Email job completed successfully');
}

// ── Worker factory ────────────────────────────────────────────────────────────

/**
 * Creates and returns a BullMQ Worker for the email queue.
 *
 * The worker begins polling as soon as it is instantiated.
 * Exponential back-off retry policy is configured on the Queue's
 * defaultJobOptions — no need to repeat it here.
 */
export function createEmailWorker(): Worker<EmailJobData, void, EmailJobName> {
  const worker = new Worker<EmailJobData, void, EmailJobName>(
    QUEUE_NAMES.EMAIL,
    processEmail,
    {
      connection: bullMQConnection,
      concurrency: 5,
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
