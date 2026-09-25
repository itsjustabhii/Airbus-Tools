"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentWorker = createPaymentWorker;
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
const shared_1 = require("@airbus-tools/shared");
const shared_2 = require("@airbus-tools/shared");
const bullmq_1 = require("bullmq");
const logger_1 = require("../../core/logger");
const Payment_1 = require("../../database/models/Payment");
const queues_1 = require("../queues");
const redis_1 = require("../redis");
const types_1 = require("../types");
// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleProcessPayment(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.PAYMENT,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        paymentId: data.paymentId,
        orderId: data.orderId,
    });
    const payment = await Payment_1.PaymentModel.findById(data.paymentId);
    if (!payment) {
        throw new Error(`Payment ${data.paymentId} not found`);
    }
    // Idempotency: already processed
    if (payment.status !== shared_1.PaymentStatus.PENDING) {
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
        await Payment_1.PaymentModel.findByIdAndUpdate(data.paymentId, {
            status: shared_1.PaymentStatus.CAPTURED,
            transactionReference: gatewayResult.transactionReference,
            gatewayResponse: gatewayResult.gatewayResponse,
            paidAt: new Date(),
        });
        log.info({ transactionReference: gatewayResult.transactionReference }, 'Payment captured successfully');
        // Notify the payer
        await (0, queues_1.enqueueNotification)({
            name: 'create-notification',
            jobId: (0, queues_1.newJobId)(),
            userId: data.payerId,
            type: shared_2.NotificationType.PAYMENT_UPDATE,
            title: 'Payment Successful',
            message: `Your payment of ${data.currency} ${data.amount} has been captured.`,
            referenceEntityType: 'PAYMENT',
            referenceEntityId: data.paymentId,
            pushViaSocket: true,
        });
    }
    else {
        await Payment_1.PaymentModel.findByIdAndUpdate(data.paymentId, {
            status: shared_1.PaymentStatus.FAILED,
            failureReason: 'Gateway declined',
        });
        log.error({ paymentId: data.paymentId }, 'Payment gateway declined');
        await (0, queues_1.enqueueNotification)({
            name: 'create-notification',
            jobId: (0, queues_1.newJobId)(),
            userId: data.payerId,
            type: shared_2.NotificationType.PAYMENT_UPDATE,
            title: 'Payment Failed',
            message: 'Your payment could not be processed. Please try again.',
            referenceEntityType: 'PAYMENT',
            referenceEntityId: data.paymentId,
            pushViaSocket: true,
        });
    }
}
async function handleRefundPayment(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.PAYMENT,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        paymentId: data.paymentId,
        orderId: data.orderId,
    });
    const payment = await Payment_1.PaymentModel.findById(data.paymentId);
    if (!payment) {
        throw new Error(`Payment ${data.paymentId} not found`);
    }
    // Idempotency: already refunded
    if (payment.status === shared_1.PaymentStatus.REFUNDED) {
        log.warn('Payment already refunded — skipping (idempotent)');
        return;
    }
    if (payment.status !== shared_1.PaymentStatus.CAPTURED) {
        throw new Error(`Cannot refund payment ${data.paymentId} in status ${payment.status} — must be CAPTURED`);
    }
    log.info('Processing refund via gateway (stub)');
    // ── Gateway refund stub ───────────────────────────────────────────────────
    // await gateway.refund({ transactionReference: payment.transactionReference, ... });
    await Payment_1.PaymentModel.findByIdAndUpdate(data.paymentId, {
        status: shared_1.PaymentStatus.REFUNDED,
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
    await (0, queues_1.enqueueNotification)({
        name: 'create-notification',
        jobId: (0, queues_1.newJobId)(),
        userId: data.requestedByUserId,
        type: shared_2.NotificationType.PAYMENT_UPDATE,
        title: 'Refund Processed',
        message: `Your refund for order has been processed.`,
        referenceEntityType: 'PAYMENT',
        referenceEntityId: data.paymentId,
        pushViaSocket: true,
    });
}
async function handleReconcilePayment(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.PAYMENT,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        paymentId: data.paymentId,
        expectedStatus: data.expectedStatus,
    });
    const payment = await Payment_1.PaymentModel.findById(data.paymentId);
    if (!payment) {
        log.warn('Payment not found during reconciliation — skipping');
        return;
    }
    if (payment.status === data.expectedStatus) {
        log.info('Payment status already matches expected — nothing to reconcile');
        return;
    }
    log.warn({ currentStatus: payment.status, expectedStatus: data.expectedStatus }, 'Payment status mismatch — reconciling');
    const update = { status: data.expectedStatus };
    if (data.transactionReference) {
        update.transactionReference = data.transactionReference;
    }
    await Payment_1.PaymentModel.findByIdAndUpdate(data.paymentId, update);
    log.info('Payment reconciled successfully');
}
// ── Main processor ────────────────────────────────────────────────────────────
async function processPayment(job) {
    const { data } = job;
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.PAYMENT,
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
            const unknownName = data.name;
            log.error({ unknownJobName: unknownName }, 'Unknown payment job name');
            throw new Error(`Unknown payment job name: ${unknownName}`);
        }
    }
    log.info('Payment job completed');
}
// ── Worker factory ────────────────────────────────────────────────────────────
function createPaymentWorker() {
    const worker = new bullmq_1.Worker(types_1.QUEUE_NAMES.PAYMENT, processPayment, {
        connection: redis_1.bullMQConnection,
        // Process payments one at a time per worker to avoid race conditions
        concurrency: 2,
    });
    worker.on('completed', (job) => {
        logger_1.logger.info({
            queue: types_1.QUEUE_NAMES.PAYMENT,
            jobId: job.data.jobId,
            bullJobId: job.id,
            name: job.name,
        }, '✅ Payment job completed');
    });
    worker.on('failed', (job, err) => {
        logger_1.logger.error({
            queue: types_1.QUEUE_NAMES.PAYMENT,
            jobId: job?.data?.jobId,
            bullJobId: job?.id,
            name: job?.name,
            attempt: job?.attemptsMade,
            err,
        }, '❌ Payment job failed');
    });
    worker.on('error', (err) => {
        logger_1.logger.error({ queue: types_1.QUEUE_NAMES.PAYMENT, err }, 'Payment worker error');
    });
    logger_1.logger.info({ queue: types_1.QUEUE_NAMES.PAYMENT }, '👷 Payment worker started');
    return worker;
}
//# sourceMappingURL=paymentWorker.js.map