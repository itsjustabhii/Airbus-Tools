/**
 * Payment queue worker.
 *
 * Handles three job types:
 *  - `process-payment`   — simulate a payment gateway call and update the
 *                          PaymentDocument status (AUTHORIZED → CAPTURED).
 *  - `refund-payment`    — initiate a refund flow and set status to REFUNDED.
 *  - `reconcile-payment` — sync the local status with the upstream gateway's
 *                          reported status and resolve mismatches.
 *
 * All handlers are idempotent: before mutating the payment record the worker
 * checks whether the payment is already in the expected terminal state.
 *
 * In a real deployment the gateway API calls (marked "// stub") are replaced
 * with actual provider SDK calls (Stripe, Adyen, etc.).
 */
import { PaymentStatus } from '@airbus-tools/shared';
import { NotificationType } from '@airbus-tools/shared';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';


import { logger } from '../../core/logger';
import { PaymentModel } from '../../database/models/Payment';
import { enqueueEmail, enqueueNotification, newJobId } from '../queues';
import { bullMQConnection } from '../redis';
import type {
  PaymentJobData,
  PaymentJobName,
  ProcessPaymentData,
  ReconcilePaymentData,
  RefundPaymentData,
} from '../types';
import { QUEUE_NAMES } from '../types';


// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleProcessPayment(
  job: Job<PaymentJobData, void, PaymentJobName>,
  data: ProcessPaymentData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.PAYMENT,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    paymentId: data.paymentId,
    orderId: data.orderId,
  });

  const payment = await PaymentModel.findById(data.paymentId);
  if (!payment) {
    throw new Error(`Payment ${data.paymentId} not found`);
  }

  // Idempotency: already processed
  if (payment.status !== PaymentStatus.PENDING) {
    log.warn({ currentStatus: payment.status }, 'Payment already processed — skipping (idempotent)');
    return;
  }

  log.info('Processing payment via gateway (stub)');

  // ── Gateway call stub ─────────────────────────────────────────────────────
  // const gatewayResult = await gateway.charge({ amount: data.amount, ... });
  // For Phase 8 we simulate success.
  const gatewayResult = {
    success: true,
    transactionReference: `TXN-${data.jobId.slice(0, 8).toUpperCase()}`,
    gatewayResponse: { stub: true, processedAt: new Date().toISOString() },
  };

  if (gatewayResult.success) {
    await PaymentModel.findByIdAndUpdate(data.paymentId, {
      status: PaymentStatus.CAPTURED,
      transactionReference: gatewayResult.transactionReference,
      gatewayResponse: gatewayResult.gatewayResponse,
      paidAt: new Date(),
    });

    log.info(
      { transactionReference: gatewayResult.transactionReference },
      'Payment captured successfully',
    );

    // Notify the payer
    await enqueueNotification({
      name: 'create-notification',
      jobId: newJobId(),
      userId: data.payerId,
      type: NotificationType.PAYMENT_UPDATE,
      title: 'Payment Successful',
      message: `Your payment of ${data.currency} ${data.amount} has been captured.`,
      referenceEntityType: 'PAYMENT',
      referenceEntityId: data.paymentId,
      pushViaSocket: true,
    });
  } else {
    await PaymentModel.findByIdAndUpdate(data.paymentId, {
      status: PaymentStatus.FAILED,
      failureReason: 'Gateway declined',
    });

    log.error({ paymentId: data.paymentId }, 'Payment gateway declined');

    await enqueueNotification({
      name: 'create-notification',
      jobId: newJobId(),
      userId: data.payerId,
      type: NotificationType.PAYMENT_UPDATE,
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please try again.',
      referenceEntityType: 'PAYMENT',
      referenceEntityId: data.paymentId,
      pushViaSocket: true,
    });
  }
}

async function handleRefundPayment(
  job: Job<PaymentJobData, void, PaymentJobName>,
  data: RefundPaymentData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.PAYMENT,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    paymentId: data.paymentId,
    orderId: data.orderId,
  });

  const payment = await PaymentModel.findById(data.paymentId);
  if (!payment) {
    throw new Error(`Payment ${data.paymentId} not found`);
  }

  // Idempotency: already refunded
  if (payment.status === PaymentStatus.REFUNDED) {
    log.warn('Payment already refunded — skipping (idempotent)');
    return;
  }

  if (payment.status !== PaymentStatus.CAPTURED) {
    throw new Error(
      `Cannot refund payment ${data.paymentId} in status ${payment.status} — must be CAPTURED`,
    );
  }

  log.info('Processing refund via gateway (stub)');

  // ── Gateway refund stub ───────────────────────────────────────────────────
  // await gateway.refund({ transactionReference: payment.transactionReference, ... });

  await PaymentModel.findByIdAndUpdate(data.paymentId, {
    status: PaymentStatus.REFUNDED,
    refundedAt: new Date(),
    gatewayResponse: {
      ...(typeof payment.gatewayResponse === 'object' && payment.gatewayResponse !== null
        ? payment.gatewayResponse
        : {}),
      refundReason: data.reason,
      refundedAt: new Date().toISOString(),
    },
  });

  log.info('Refund processed successfully');

  await enqueueNotification({
    name: 'create-notification',
    jobId: newJobId(),
    userId: data.requestedByUserId,
    type: NotificationType.PAYMENT_UPDATE,
    title: 'Refund Processed',
    message: `Your refund for order has been processed.`,
    referenceEntityType: 'PAYMENT',
    referenceEntityId: data.paymentId,
    pushViaSocket: true,
  });
}

async function handleReconcilePayment(
  job: Job<PaymentJobData, void, PaymentJobName>,
  data: ReconcilePaymentData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.PAYMENT,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    paymentId: data.paymentId,
    expectedStatus: data.expectedStatus,
  });

  const payment = await PaymentModel.findById(data.paymentId);
  if (!payment) {
    log.warn('Payment not found during reconciliation — skipping');
    return;
  }

  if (payment.status === data.expectedStatus) {
    log.info('Payment status already matches expected — nothing to reconcile');
    return;
  }

  log.warn(
    { currentStatus: payment.status, expectedStatus: data.expectedStatus },
    'Payment status mismatch — reconciling',
  );

  const update: Record<string, unknown> = { status: data.expectedStatus };
  if (data.transactionReference) {
    update.transactionReference = data.transactionReference;
  }

  await PaymentModel.findByIdAndUpdate(data.paymentId, update);

  log.info('Payment reconciled successfully');
}

// ── Main processor ────────────────────────────────────────────────────────────

async function processPayment(
  job: Job<PaymentJobData, void, PaymentJobName>,
): Promise<void> {
  const { data } = job;

  const log = logger.child({
    queue: QUEUE_NAMES.PAYMENT,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    attempt: job.attemptsMade,
  });

  log.info('Processing payment job');

  switch (data.name) {
    case 'process-payment':
      await handleProcessPayment(job, data);
      break;
    case 'refund-payment':
      await handleRefundPayment(job, data);
      break;
    case 'reconcile-payment':
      await handleReconcilePayment(job, data);
      break;
    default: {
      const unknownName = (data as { name: string }).name;
      log.error({ unknownJobName: unknownName }, 'Unknown payment job name');
      throw new Error(`Unknown payment job name: ${unknownName}`);
    }
  }

  log.info('Payment job completed');
}

// ── Worker factory ────────────────────────────────────────────────────────────

export function createPaymentWorker(): Worker<PaymentJobData, void, PaymentJobName> {
  const worker = new Worker<PaymentJobData, void, PaymentJobName>(
    QUEUE_NAMES.PAYMENT,
    processPayment,
    {
      connection: bullMQConnection,
      // Process payments one at a time per worker to avoid race conditions
      concurrency: 2,
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      {
        queue: QUEUE_NAMES.PAYMENT,
        jobId: job.data.jobId,
        bullJobId: job.id,
        name: job.name,
      },
      '✅ Payment job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        queue: QUEUE_NAMES.PAYMENT,
        jobId: job?.data?.jobId,
        bullJobId: job?.id,
        name: job?.name,
        attempt: job?.attemptsMade,
        err,
      },
      '❌ Payment job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ queue: QUEUE_NAMES.PAYMENT, err }, 'Payment worker error');
  });

  logger.info({ queue: QUEUE_NAMES.PAYMENT }, '👷 Payment worker started');

  return worker;
}
