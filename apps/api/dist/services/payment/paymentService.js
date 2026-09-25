"use strict";
/**
 * PaymentService — orchestrates the full payment lifecycle.
 *
 * Design principles enforced here:
 *
 * 1. Provider abstraction: every call goes through IPaymentProvider, never to
 *    a concrete SDK.
 *
 * 2. Idempotency: createPayment accepts a caller-supplied idempotency key.
 *    The same key always returns the existing payment record without creating
 *    a duplicate (enforced at both the service and DB index levels).
 *
 * 3. Webhook is authoritative: the PAID order status is ONLY set inside
 *    handleWebhook.  confirmPayment records the intent confirmation but does
 *    NOT advance the order — that happens when the provider calls back with
 *    a `payment.succeeded` event.
 *
 * 4. Safe retries: all state mutations are guarded by the payment state
 *    machine before writing, so retried webhook deliveries are no-ops.
 *
 * 5. Order/payment consistency: the order advances to PAID inside the same
 *    logical operation as the payment status update.  Both happen in sequence;
 *    a failure after the payment update (but before the order update) is caught
 *    on the next webhook retry (idempotency guard skips the already-captured
 *    payment but re-applies the order update if the order is still PAYMENT_PENDING).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const shared_1 = require("@airbus-tools/shared");
const uuid_1 = require("uuid");
const errors_1 = require("../../core/errors");
const logger_1 = require("../../core/logger");
const OrderRepository_1 = require("../../database/repositories/OrderRepository");
const PaymentRepository_1 = require("../../database/repositories/PaymentRepository");
const queues_1 = require("../../jobs/queues");
const paymentStateMachine_1 = require("./paymentStateMachine");
// ── Helpers ──────────────────────────────────────────────────────────────────
function generatePaymentNumber() {
    const year = new Date().getFullYear();
    const uid = (0, uuid_1.v4)().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `PAY-${year}-${uid}`;
}
// ── Service ──────────────────────────────────────────────────────────────────
class PaymentService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    // ── createPayment ──────────────────────────────────────────────────────────
    /**
     * Create a payment intent for an accepted order.
     *
     * The order must be in PAYMENT_PENDING status (the airline has already
     * transitioned ACCEPTED → PAYMENT_PENDING via the orders endpoint).
     * Only the buyer (airline) or an admin may initiate a payment.
     *
     * Idempotency: if a payment already exists for this idempotencyKey the
     * existing record is returned unchanged.
     */
    async createPayment(input) {
        const { orderId, callerId, callerRole, paymentMethod, idempotencyKey } = input;
        // ── Idempotency check ────────────────────────────────────────────────────
        const existing = await PaymentRepository_1.paymentRepository.findByIdempotencyKey(idempotencyKey);
        if (existing) {
            logger_1.logger.info({ paymentId: existing._id.toString(), idempotencyKey }, 'Returning existing payment (idempotent)');
            return existing;
        }
        // ── Order validation ─────────────────────────────────────────────────────
        const order = await OrderRepository_1.orderRepository.findById(orderId);
        if (!order) {
            throw new errors_1.NotFoundError('Order not found');
        }
        this.assertOrderParticipant(order, callerId, callerRole);
        if (callerRole !== shared_1.UserRole.ADMIN && order.buyerId.toString() !== callerId) {
            throw new errors_1.ForbiddenError('Only the buyer may initiate a payment');
        }
        if (order.status !== shared_1.OrderStatus.PAYMENT_PENDING) {
            throw new errors_1.AppError(`Order must be in PAYMENT_PENDING status to create a payment (current: ${order.status})`, 409, 'INVALID_ORDER_STATUS');
        }
        // ── Create provider intent ───────────────────────────────────────────────
        const intentResult = await this.provider.createIntent({
            idempotencyKey,
            amount: Math.round(order.totalAmount * 100), // smallest currency unit
            currency: input.currency ?? order.currency,
            orderNumber: order.orderNumber,
            metadata: { orderId, callerId },
        });
        // ── Persist payment record ───────────────────────────────────────────────
        const payment = await PaymentRepository_1.paymentRepository.create({
            paymentNumber: generatePaymentNumber(),
            orderId: order._id,
            payerId: order.buyerId,
            payeeId: order.sellerId,
            amount: order.totalAmount,
            currency: input.currency ?? order.currency,
            paymentMethod,
            status: shared_1.PaymentStatus.PENDING,
            providerPaymentId: intentResult.providerPaymentId,
            idempotencyKey,
            gatewayResponse: intentResult.raw,
        });
        logger_1.logger.info({ paymentId: payment._id.toString(), providerPaymentId: intentResult.providerPaymentId }, 'Payment intent created');
        return payment;
    }
    // ── confirmPayment ─────────────────────────────────────────────────────────
    /**
     * Confirm a previously-created payment intent.
     *
     * This tells the provider to attempt to capture the funds.  The payment
     * status is updated locally to AUTHORIZED or FAILED, but the order is NOT
     * yet advanced to PAID here — the webhook is the authoritative confirmation
     * path.
     *
     * Safe retry: if the payment is already AUTHORIZED or beyond, this is a
     * no-op that returns the current record.
     */
    async confirmPayment(input) {
        const { paymentId, callerId, callerRole } = input;
        const payment = await PaymentRepository_1.paymentRepository.findById(paymentId);
        if (!payment) {
            throw new errors_1.NotFoundError('Payment not found');
        }
        // Only the payer or admin may confirm
        if (callerRole !== shared_1.UserRole.ADMIN && payment.payerId.toString() !== callerId) {
            throw new errors_1.ForbiddenError('Only the payer may confirm a payment');
        }
        // Idempotency: already past PENDING — return current state
        if (payment.status !== shared_1.PaymentStatus.PENDING) {
            logger_1.logger.info({ paymentId, status: payment.status }, 'Payment already confirmed — returning current state (idempotent)');
            return payment;
        }
        if (!payment.providerPaymentId) {
            throw new errors_1.AppError('Payment has no provider payment ID', 500, 'INTERNAL_ERROR');
        }
        // ── Call provider ────────────────────────────────────────────────────────
        const confirmInput = {
            providerPaymentId: payment.providerPaymentId,
        };
        if (input.paymentMethodToken !== undefined) {
            confirmInput.paymentMethodToken = input.paymentMethodToken;
        }
        const result = await this.provider.confirmIntent(confirmInput);
        const nextStatus = result.success ? shared_1.PaymentStatus.AUTHORIZED : shared_1.PaymentStatus.FAILED;
        (0, paymentStateMachine_1.assertPaymentTransition)(payment.status, nextStatus);
        const updateFields = {
            status: nextStatus,
            transactionReference: result.transactionReference,
            gatewayResponse: result.raw,
        };
        if (!result.success) {
            updateFields.failureReason = result.failureReason ?? 'Gateway declined';
        }
        const updated = await PaymentRepository_1.paymentRepository.updateById(paymentId, updateFields);
        if (!updated)
            throw new errors_1.NotFoundError('Payment not found');
        logger_1.logger.info({ paymentId, status: nextStatus }, 'Payment confirmation result recorded');
        if (!result.success) {
            void this.enqueuePaymentFailedNotification(updated);
        }
        return updated;
    }
    // ── getPayment ─────────────────────────────────────────────────────────────
    async getPayment(paymentId, callerId, callerRole) {
        const payment = await PaymentRepository_1.paymentRepository.findById(paymentId);
        if (!payment)
            throw new errors_1.NotFoundError('Payment not found');
        if (callerRole === shared_1.UserRole.ADMIN)
            return payment;
        const isPayer = payment.payerId.toString() === callerId;
        const isPayee = payment.payeeId.toString() === callerId;
        if (!isPayer && !isPayee) {
            throw new errors_1.NotFoundError('Payment not found');
        }
        return payment;
    }
    // ── refundPayment ──────────────────────────────────────────────────────────
    /**
     * Initiate a full refund for a captured payment.
     *
     * Only the buyer or an admin may request a refund.
     * The payment must be in CAPTURED status.
     *
     * Safe retry: if the payment is already REFUNDED this is a no-op.
     */
    async refundPayment(input) {
        const { paymentId, callerId, callerRole, reason } = input;
        const payment = await PaymentRepository_1.paymentRepository.findById(paymentId);
        if (!payment)
            throw new errors_1.NotFoundError('Payment not found');
        if (callerRole !== shared_1.UserRole.ADMIN && payment.payerId.toString() !== callerId) {
            throw new errors_1.ForbiddenError('Only the payer or admin may request a refund');
        }
        // Idempotency: already refunded
        if (payment.status === shared_1.PaymentStatus.REFUNDED) {
            logger_1.logger.info({ paymentId }, 'Payment already refunded — no-op (idempotent)');
            return payment;
        }
        (0, paymentStateMachine_1.assertPaymentTransition)(payment.status, shared_1.PaymentStatus.REFUNDED);
        if (!payment.providerPaymentId) {
            throw new errors_1.AppError('Payment has no provider payment ID', 500, 'INTERNAL_ERROR');
        }
        const refundInput = {
            providerPaymentId: payment.providerPaymentId,
            transactionReference: payment.transactionReference ?? '',
        };
        if (reason !== undefined) {
            refundInput.reason = reason;
        }
        const refundResult = await this.provider.refund(refundInput);
        const updated = await PaymentRepository_1.paymentRepository.updateById(paymentId, {
            status: shared_1.PaymentStatus.REFUNDED,
            refundedAt: new Date(),
            gatewayResponse: {
                ...(typeof payment.gatewayResponse === 'object' && payment.gatewayResponse !== null
                    ? payment.gatewayResponse
                    : {}),
                refund: refundResult.raw,
            },
        });
        if (!updated)
            throw new errors_1.NotFoundError('Payment not found');
        logger_1.logger.info({ paymentId, refundReference: refundResult.refundReference }, 'Payment refunded');
        void Promise.allSettled([
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: payment.payerId.toString(),
                type: shared_1.NotificationType.PAYMENT_UPDATE,
                title: 'Refund Processed',
                message: `Your refund for payment ${payment.paymentNumber} has been processed.`,
                referenceEntityType: 'PAYMENT',
                referenceEntityId: paymentId,
                pushViaSocket: true,
            }),
        ]);
        return updated;
    }
    // ── handleWebhook ──────────────────────────────────────────────────────────
    /**
     * Process a raw webhook delivery from the payment provider.
     *
     * This is the authoritative path for:
     *   - payment.succeeded → PaymentStatus.CAPTURED + OrderStatus.PAID
     *   - payment.failed    → PaymentStatus.FAILED
     *   - payment.refunded  → PaymentStatus.REFUNDED
     *
     * All mutations are guarded by the state machine so duplicate deliveries
     * are safe no-ops.
     *
     * Throws if the signature is invalid (caller should return HTTP 400).
     */
    async handleWebhook(rawBody, signature) {
        // Signature validation — throws INVALID_WEBHOOK_SIGNATURE on failure
        let event;
        try {
            event = this.provider.parseWebhook(rawBody, signature);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new errors_1.AppError(`Webhook signature validation failed: ${message}`, 400, 'INVALID_WEBHOOK_SIGNATURE');
        }
        const log = logger_1.logger.child({ webhookEvent: event.eventType, providerPaymentId: event.providerPaymentId });
        log.info('Processing webhook event');
        const payment = await PaymentRepository_1.paymentRepository.findByProviderPaymentId(event.providerPaymentId);
        if (!payment) {
            // Not ours — acknowledge to prevent retries
            log.warn({ providerPaymentId: event.providerPaymentId }, 'Webhook references unknown payment — ignoring');
            return;
        }
        const paymentId = payment._id.toString();
        switch (event.eventType) {
            case 'payment.succeeded':
                await this.handleWebhookSucceeded(payment, paymentId, event);
                break;
            case 'payment.failed':
                await this.handleWebhookFailed(payment, paymentId, event);
                break;
            case 'payment.refunded':
                await this.handleWebhookRefunded(payment, paymentId, event);
                break;
        }
    }
    // ── Private webhook sub-handlers ───────────────────────────────────────────
    async handleWebhookSucceeded(payment, paymentId, event) {
        const log = logger_1.logger.child({ paymentId, providerPaymentId: event.providerPaymentId });
        // Idempotency: already CAPTURED — re-apply order update in case it was missed
        if (payment.status === shared_1.PaymentStatus.CAPTURED) {
            log.info('Webhook: payment already CAPTURED — checking order consistency');
            await this.ensureOrderPaid(payment.orderId.toString(), log);
            return;
        }
        // State machine guard
        try {
            (0, paymentStateMachine_1.assertPaymentTransition)(payment.status, shared_1.PaymentStatus.CAPTURED);
        }
        catch {
            log.warn({ currentStatus: payment.status }, 'Webhook: cannot transition to CAPTURED — ignoring');
            return;
        }
        // Update payment
        await PaymentRepository_1.paymentRepository.updateById(paymentId, {
            status: shared_1.PaymentStatus.CAPTURED,
            transactionReference: event.transactionReference,
            gatewayResponse: event.raw,
            paidAt: new Date(),
        });
        log.info('Webhook: payment marked CAPTURED');
        // Advance order — this is the ONLY place the order moves to PAID
        await this.ensureOrderPaid(payment.orderId.toString(), log);
        // Side-effects
        void Promise.allSettled([
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: payment.payerId.toString(),
                type: shared_1.NotificationType.PAYMENT_UPDATE,
                title: 'Payment Successful',
                message: `Your payment of ${payment.currency} ${payment.amount} has been captured.`,
                referenceEntityType: 'PAYMENT',
                referenceEntityId: paymentId,
                pushViaSocket: true,
            }),
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: payment.payeeId.toString(),
                type: shared_1.NotificationType.PAYMENT_UPDATE,
                title: 'Payment Received',
                message: `You have received a payment of ${payment.currency} ${payment.amount}.`,
                referenceEntityType: 'PAYMENT',
                referenceEntityId: paymentId,
                pushViaSocket: true,
            }),
            (0, queues_1.enqueueEmail)({
                name: 'send-payment-confirmation',
                jobId: (0, queues_1.newJobId)(),
                to: '', // resolved in worker via DB lookup
                recipientName: '',
                paymentNumber: payment.paymentNumber,
                paymentId,
                orderId: payment.orderId.toString(),
                orderNumber: '', // resolved in worker via DB lookup
                amount: payment.amount,
                currency: payment.currency,
            }),
        ]);
    }
    async handleWebhookFailed(payment, paymentId, event) {
        const log = logger_1.logger.child({ paymentId, providerPaymentId: event.providerPaymentId });
        if (payment.status === shared_1.PaymentStatus.FAILED) {
            log.info('Webhook: payment already FAILED — skipping (idempotent)');
            return;
        }
        try {
            (0, paymentStateMachine_1.assertPaymentTransition)(payment.status, shared_1.PaymentStatus.FAILED);
        }
        catch {
            log.warn({ currentStatus: payment.status }, 'Webhook: cannot transition to FAILED — ignoring');
            return;
        }
        await PaymentRepository_1.paymentRepository.updateById(paymentId, {
            status: shared_1.PaymentStatus.FAILED,
            failureReason: event.failureReason ?? 'Payment declined by provider',
            gatewayResponse: event.raw,
        });
        log.info('Webhook: payment marked FAILED');
        void this.enqueuePaymentFailedNotification(payment);
    }
    async handleWebhookRefunded(payment, paymentId, event) {
        const log = logger_1.logger.child({ paymentId, providerPaymentId: event.providerPaymentId });
        if (payment.status === shared_1.PaymentStatus.REFUNDED) {
            log.info('Webhook: payment already REFUNDED — skipping (idempotent)');
            return;
        }
        try {
            (0, paymentStateMachine_1.assertPaymentTransition)(payment.status, shared_1.PaymentStatus.REFUNDED);
        }
        catch {
            log.warn({ currentStatus: payment.status }, 'Webhook: cannot transition to REFUNDED — ignoring');
            return;
        }
        await PaymentRepository_1.paymentRepository.updateById(paymentId, {
            status: shared_1.PaymentStatus.REFUNDED,
            refundedAt: new Date(),
            gatewayResponse: event.raw,
        });
        log.info('Webhook: payment marked REFUNDED');
        void (0, queues_1.enqueueNotification)({
            name: 'create-notification',
            jobId: (0, queues_1.newJobId)(),
            userId: payment.payerId.toString(),
            type: shared_1.NotificationType.PAYMENT_UPDATE,
            title: 'Payment Refunded',
            message: `Your payment ${payment.paymentNumber} has been refunded.`,
            referenceEntityType: 'PAYMENT',
            referenceEntityId: paymentId,
            pushViaSocket: true,
        });
    }
    // ── Private helpers ────────────────────────────────────────────────────────
    /**
     * Advance the associated order to PAID if it is still PAYMENT_PENDING.
     * This is called by the webhook success handler — it is the ONLY place
     * the order may move to PAID.
     */
    async ensureOrderPaid(orderId, log) {
        const order = await OrderRepository_1.orderRepository.findById(orderId);
        if (!order) {
            log.error({ orderId }, 'Webhook: referenced order not found');
            return;
        }
        if (order.status === shared_1.OrderStatus.PAID) {
            log.info({ orderId }, 'Order already PAID — skipping (idempotent)');
            return;
        }
        if (order.status !== shared_1.OrderStatus.PAYMENT_PENDING) {
            log.warn({ orderId, status: order.status }, 'Order not in PAYMENT_PENDING — cannot advance to PAID');
            return;
        }
        await OrderRepository_1.orderRepository.updateById(orderId, {
            status: shared_1.OrderStatus.PAID,
            paidAt: new Date(),
        });
        log.info({ orderId }, 'Order advanced to PAID');
        void Promise.allSettled([
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: order.buyerId.toString(),
                type: shared_1.NotificationType.ORDER_UPDATE,
                title: 'Order Paid',
                message: `Your order ${order.orderNumber} has been paid and is awaiting fulfilment.`,
                referenceEntityType: 'ORDER',
                referenceEntityId: orderId,
                pushViaSocket: true,
            }),
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: order.sellerId.toString(),
                type: shared_1.NotificationType.ORDER_UPDATE,
                title: 'Order Payment Received',
                message: `Order ${order.orderNumber} has been paid. Please proceed with fulfilment.`,
                referenceEntityType: 'ORDER',
                referenceEntityId: orderId,
                pushViaSocket: true,
            }),
        ]);
    }
    enqueuePaymentFailedNotification(payment) {
        return (0, queues_1.enqueueNotification)({
            name: 'create-notification',
            jobId: (0, queues_1.newJobId)(),
            userId: payment.payerId.toString(),
            type: shared_1.NotificationType.PAYMENT_UPDATE,
            title: 'Payment Failed',
            message: 'Your payment could not be processed. Please try again.',
            referenceEntityType: 'PAYMENT',
            referenceEntityId: payment._id.toString(),
            pushViaSocket: true,
        });
    }
    assertOrderParticipant(order, callerId, callerRole) {
        if (callerRole === shared_1.UserRole.ADMIN)
            return;
        const isBuyer = order.buyerId.toString() === callerId;
        const isSeller = order.sellerId.toString() === callerId;
        if (!isBuyer && !isSeller) {
            throw new errors_1.NotFoundError('Order not found');
        }
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=paymentService.js.map