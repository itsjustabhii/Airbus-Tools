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
import { PaymentMethod, UserRole } from '@airbus-tools/shared';
import type { IPaymentDocument } from '../../database/models/Payment';
import type { IPaymentProvider } from './IPaymentProvider';
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
export declare class PaymentService {
    private readonly provider;
    constructor(provider: IPaymentProvider);
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
    createPayment(input: CreatePaymentInput): Promise<IPaymentDocument>;
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
    confirmPayment(input: ConfirmPaymentInput): Promise<IPaymentDocument>;
    getPayment(paymentId: string, callerId: string, callerRole: UserRole): Promise<IPaymentDocument>;
    /**
     * Initiate a full refund for a captured payment.
     *
     * Only the buyer or an admin may request a refund.
     * The payment must be in CAPTURED status.
     *
     * Safe retry: if the payment is already REFUNDED this is a no-op.
     */
    refundPayment(input: RefundPaymentInput): Promise<IPaymentDocument>;
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
    handleWebhook(rawBody: Buffer, signature: string): Promise<void>;
    private handleWebhookSucceeded;
    private handleWebhookFailed;
    private handleWebhookRefunded;
    /**
     * Advance the associated order to PAID if it is still PAYMENT_PENDING.
     * This is called by the webhook success handler — it is the ONLY place
     * the order may move to PAID.
     */
    private ensureOrderPaid;
    private enqueuePaymentFailedNotification;
    private assertOrderParticipant;
}
//# sourceMappingURL=paymentService.d.ts.map