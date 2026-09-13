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

import { v4 as uuidv4 } from 'uuid';

import { NotificationType, OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@airbus-tools/shared';

import { AppError, ForbiddenError, NotFoundError } from '../../core/errors';
import { logger } from '../../core/logger';
import type { IOrderDocument } from '../../database/models/Order';
import type { IPaymentDocument } from '../../database/models/Payment';
import { orderRepository } from '../../database/repositories/OrderRepository';
import { paymentRepository } from '../../database/repositories/PaymentRepository';
import { enqueueEmail, enqueueNotification, newJobId } from '../../jobs/queues';

import type { IPaymentProvider, ParsedWebhookEvent } from './IPaymentProvider';
import { assertPaymentTransition } from './paymentStateMachine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreatePaymentInput {
  orderId: string;
  callerId: string;
  callerRole: UserRole;
  paymentMethod: PaymentMethod;
  currency?: string;
  /**
   * Caller-supplied idempotency key.  Two requests with the same key return
   * the existing payment without creating a duplicate.
   */
  idempotencyKey: string;
}

export interface ConfirmPaymentInput {
  paymentId: string;
  callerId: string;
  callerRole: UserRole;
  /** Provider SDK token returned after the client-side payment UI. */
  paymentMethodToken?: string;
}

export interface RefundPaymentInput {
  paymentId: string;
  callerId: string;
  callerRole: UserRole;
  reason?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generatePaymentNumber(): string {
  const year = new Date().getFullYear();
  const uid  = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `PAY-${year}-${uid}`;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class PaymentService {
  constructor(private readonly provider: IPaymentProvider) {}

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
  async createPayment(input: CreatePaymentInput): Promise<IPaymentDocument> {
    const { orderId, callerId, callerRole, paymentMethod, idempotencyKey } = input;

    // ── Idempotency check ────────────────────────────────────────────────────
    const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      logger.info({ paymentId: existing._id.toString(), idempotencyKey }, 'Returning existing payment (idempotent)');
      return existing;
    }

    // ── Order validation ─────────────────────────────────────────────────────
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    this.assertOrderParticipant(order, callerId, callerRole);

    if (callerRole !== UserRole.ADMIN && order.buyerId.toString() !== callerId) {
      throw new ForbiddenError('Only the buyer may initiate a payment');
    }

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new AppError(
        `Order must be in PAYMENT_PENDING status to create a payment (current: ${order.status})`,
        409,
        'INVALID_ORDER_STATUS',
      );
    }

    // ── Create provider intent ───────────────────────────────────────────────
    const intentResult = await this.provider.createIntent({
      idempotencyKey,
      amount:      Math.round(order.totalAmount * 100), // smallest currency unit
      currency:    input.currency ?? order.currency,
      orderNumber: order.orderNumber,
      metadata:    { orderId, callerId },
    });

    // ── Persist payment record ───────────────────────────────────────────────
    const payment = await paymentRepository.create({
      paymentNumber:   generatePaymentNumber(),
      orderId:         order._id,
      payerId:         order.buyerId,
      payeeId:         order.sellerId,
      amount:          order.totalAmount,
      currency:        input.currency ?? order.currency,
      paymentMethod,
      status:          PaymentStatus.PENDING,
      providerPaymentId: intentResult.providerPaymentId,
      idempotencyKey,
      gatewayResponse: intentResult.raw,
    });

    logger.info(
      { paymentId: payment._id.toString(), providerPaymentId: intentResult.providerPaymentId },
      'Payment intent created',
    );

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
  async confirmPayment(input: ConfirmPaymentInput): Promise<IPaymentDocument> {
    const { paymentId, callerId, callerRole } = input;

    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Only the payer or admin may confirm
    if (callerRole !== UserRole.ADMIN && payment.payerId.toString() !== callerId) {
      throw new ForbiddenError('Only the payer may confirm a payment');
    }

    // Idempotency: already past PENDING — return current state
    if (payment.status !== PaymentStatus.PENDING) {
      logger.info({ paymentId, status: payment.status }, 'Payment already confirmed — returning current state (idempotent)');
      return payment;
    }

    if (!payment.providerPaymentId) {
      throw new AppError('Payment has no provider payment ID', 500, 'INTERNAL_ERROR');
    }

    // ── Call provider ────────────────────────────────────────────────────────
    const confirmInput: import('./IPaymentProvider').ConfirmPaymentInput = {
      providerPaymentId: payment.providerPaymentId,
    };
    if (input.paymentMethodToken !== undefined) {
      confirmInput.paymentMethodToken = input.paymentMethodToken;
    }
    const result = await this.provider.confirmIntent(confirmInput);

    const nextStatus = result.success ? PaymentStatus.AUTHORIZED : PaymentStatus.FAILED;
    assertPaymentTransition(payment.status, nextStatus);

    const updateFields: Record<string, unknown> = {
      status:              nextStatus,
      transactionReference: result.transactionReference,
      gatewayResponse:      result.raw,
    };
    if (!result.success) {
      updateFields.failureReason = result.failureReason ?? 'Gateway declined';
    }

    const updated = await paymentRepository.updateById(paymentId, updateFields);
    if (!updated) throw new NotFoundError('Payment not found');

    logger.info({ paymentId, status: nextStatus }, 'Payment confirmation result recorded');

    if (!result.success) {
      void this.enqueuePaymentFailedNotification(updated);
    }

    return updated;
  }

  // ── getPayment ─────────────────────────────────────────────────────────────

  async getPayment(paymentId: string, callerId: string, callerRole: UserRole): Promise<IPaymentDocument> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found');

    if (callerRole === UserRole.ADMIN) return payment;

    const isPayer = payment.payerId.toString() === callerId;
    const isPayee = payment.payeeId.toString() === callerId;
    if (!isPayer && !isPayee) {
      throw new NotFoundError('Payment not found');
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
  async refundPayment(input: RefundPaymentInput): Promise<IPaymentDocument> {
    const { paymentId, callerId, callerRole, reason } = input;

    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found');

    if (callerRole !== UserRole.ADMIN && payment.payerId.toString() !== callerId) {
      throw new ForbiddenError('Only the payer or admin may request a refund');
    }

    // Idempotency: already refunded
    if (payment.status === PaymentStatus.REFUNDED) {
      logger.info({ paymentId }, 'Payment already refunded — no-op (idempotent)');
      return payment;
    }

    assertPaymentTransition(payment.status, PaymentStatus.REFUNDED);

    if (!payment.providerPaymentId) {
      throw new AppError('Payment has no provider payment ID', 500, 'INTERNAL_ERROR');
    }

    const refundInput: import('./IPaymentProvider').RefundPaymentInput = {
      providerPaymentId:    payment.providerPaymentId,
      transactionReference: payment.transactionReference ?? '',
    };
    if (reason !== undefined) {
      refundInput.reason = reason;
    }
    const refundResult = await this.provider.refund(refundInput);

    const updated = await paymentRepository.updateById(paymentId, {
      status:      PaymentStatus.REFUNDED,
      refundedAt:  new Date(),
      gatewayResponse: {
        ...(typeof payment.gatewayResponse === 'object' && payment.gatewayResponse !== null
          ? payment.gatewayResponse
          : {}),
        refund: refundResult.raw,
      },
    });
    if (!updated) throw new NotFoundError('Payment not found');

    logger.info({ paymentId, refundReference: refundResult.refundReference }, 'Payment refunded');

    void Promise.allSettled([
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: payment.payerId.toString(),
        type: NotificationType.PAYMENT_UPDATE,
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
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    // Signature validation — throws INVALID_WEBHOOK_SIGNATURE on failure
    let event: ParsedWebhookEvent;
    try {
      event = this.provider.parseWebhook(rawBody, signature);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError(`Webhook signature validation failed: ${message}`, 400, 'INVALID_WEBHOOK_SIGNATURE');
    }

    const log = logger.child({ webhookEvent: event.eventType, providerPaymentId: event.providerPaymentId });
    log.info('Processing webhook event');

    const payment = await paymentRepository.findByProviderPaymentId(event.providerPaymentId);
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

  private async handleWebhookSucceeded(
    payment: IPaymentDocument,
    paymentId: string,
    event: ParsedWebhookEvent,
  ): Promise<void> {
    const log = logger.child({ paymentId, providerPaymentId: event.providerPaymentId });

    // Idempotency: already CAPTURED — re-apply order update in case it was missed
    if (payment.status === PaymentStatus.CAPTURED) {
      log.info('Webhook: payment already CAPTURED — checking order consistency');
      await this.ensureOrderPaid(payment.orderId.toString(), log);
      return;
    }

    // State machine guard
    try {
      assertPaymentTransition(payment.status, PaymentStatus.CAPTURED);
    } catch {
      log.warn({ currentStatus: payment.status }, 'Webhook: cannot transition to CAPTURED — ignoring');
      return;
    }

    // Update payment
    await paymentRepository.updateById(paymentId, {
      status:              PaymentStatus.CAPTURED,
      transactionReference: event.transactionReference,
      gatewayResponse:      event.raw,
      paidAt:               new Date(),
    });

    log.info('Webhook: payment marked CAPTURED');

    // Advance order — this is the ONLY place the order moves to PAID
    await this.ensureOrderPaid(payment.orderId.toString(), log);

    // Side-effects
    void Promise.allSettled([
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: payment.payerId.toString(),
        type: NotificationType.PAYMENT_UPDATE,
        title: 'Payment Successful',
        message: `Your payment of ${payment.currency} ${payment.amount} has been captured.`,
        referenceEntityType: 'PAYMENT',
        referenceEntityId: paymentId,
        pushViaSocket: true,
      }),
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: payment.payeeId.toString(),
        type: NotificationType.PAYMENT_UPDATE,
        title: 'Payment Received',
        message: `You have received a payment of ${payment.currency} ${payment.amount}.`,
        referenceEntityType: 'PAYMENT',
        referenceEntityId: paymentId,
        pushViaSocket: true,
      }),
      enqueueEmail({
        name: 'send-payment-confirmation',
        jobId: newJobId(),
        to: '',          // resolved in worker via DB lookup
        recipientName: '',
        paymentNumber: payment.paymentNumber,
        paymentId,
        orderId: payment.orderId.toString(),
        orderNumber: '',  // resolved in worker via DB lookup
        amount: payment.amount,
        currency: payment.currency,
      }),
    ]);
  }

  private async handleWebhookFailed(
    payment: IPaymentDocument,
    paymentId: string,
    event: ParsedWebhookEvent,
  ): Promise<void> {
    const log = logger.child({ paymentId, providerPaymentId: event.providerPaymentId });

    if (payment.status === PaymentStatus.FAILED) {
      log.info('Webhook: payment already FAILED — skipping (idempotent)');
      return;
    }

    try {
      assertPaymentTransition(payment.status, PaymentStatus.FAILED);
    } catch {
      log.warn({ currentStatus: payment.status }, 'Webhook: cannot transition to FAILED — ignoring');
      return;
    }

    await paymentRepository.updateById(paymentId, {
      status:        PaymentStatus.FAILED,
      failureReason: event.failureReason ?? 'Payment declined by provider',
      gatewayResponse: event.raw,
    });

    log.info('Webhook: payment marked FAILED');

    void this.enqueuePaymentFailedNotification(payment);
  }

  private async handleWebhookRefunded(
    payment: IPaymentDocument,
    paymentId: string,
    event: ParsedWebhookEvent,
  ): Promise<void> {
    const log = logger.child({ paymentId, providerPaymentId: event.providerPaymentId });

    if (payment.status === PaymentStatus.REFUNDED) {
      log.info('Webhook: payment already REFUNDED — skipping (idempotent)');
      return;
    }

    try {
      assertPaymentTransition(payment.status, PaymentStatus.REFUNDED);
    } catch {
      log.warn({ currentStatus: payment.status }, 'Webhook: cannot transition to REFUNDED — ignoring');
      return;
    }

    await paymentRepository.updateById(paymentId, {
      status:      PaymentStatus.REFUNDED,
      refundedAt:  new Date(),
      gatewayResponse: event.raw,
    });

    log.info('Webhook: payment marked REFUNDED');

    void enqueueNotification({
      name: 'create-notification',
      jobId: newJobId(),
      userId: payment.payerId.toString(),
      type: NotificationType.PAYMENT_UPDATE,
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
  private async ensureOrderPaid(
    orderId: string,
    log: typeof logger,
  ): Promise<void> {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      log.error({ orderId }, 'Webhook: referenced order not found');
      return;
    }

    if (order.status === OrderStatus.PAID) {
      log.info({ orderId }, 'Order already PAID — skipping (idempotent)');
      return;
    }

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      log.warn({ orderId, status: order.status }, 'Order not in PAYMENT_PENDING — cannot advance to PAID');
      return;
    }

    await orderRepository.updateById(orderId, {
      status: OrderStatus.PAID,
      paidAt: new Date(),
    });

    log.info({ orderId }, 'Order advanced to PAID');

    void Promise.allSettled([
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: order.buyerId.toString(),
        type: NotificationType.ORDER_UPDATE,
        title: 'Order Paid',
        message: `Your order ${order.orderNumber} has been paid and is awaiting fulfilment.`,
        referenceEntityType: 'ORDER',
        referenceEntityId: orderId,
        pushViaSocket: true,
      }),
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: order.sellerId.toString(),
        type: NotificationType.ORDER_UPDATE,
        title: 'Order Payment Received',
        message: `Order ${order.orderNumber} has been paid. Please proceed with fulfilment.`,
        referenceEntityType: 'ORDER',
        referenceEntityId: orderId,
        pushViaSocket: true,
      }),
    ]);
  }

  private enqueuePaymentFailedNotification(payment: IPaymentDocument): Promise<void> {
    return enqueueNotification({
      name: 'create-notification',
      jobId: newJobId(),
      userId: payment.payerId.toString(),
      type: NotificationType.PAYMENT_UPDATE,
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please try again.',
      referenceEntityType: 'PAYMENT',
      referenceEntityId: payment._id.toString(),
      pushViaSocket: true,
    });
  }

  private assertOrderParticipant(
    order: IOrderDocument,
    callerId: string,
    callerRole: UserRole,
  ): void {
    if (callerRole === UserRole.ADMIN) return;

    const isBuyer  = order.buyerId.toString()  === callerId;
    const isSeller = order.sellerId.toString() === callerId;

    if (!isBuyer && !isSeller) {
      throw new NotFoundError('Order not found');
    }
  }
}
