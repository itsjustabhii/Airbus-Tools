/**
 * Payment state machine.
 *
 * Valid transitions:
 *   PENDING    → AUTHORIZED   (after provider confirms intent — webhook)
 *   PENDING    → FAILED       (provider reports failure — webhook or confirm)
 *   AUTHORIZED → CAPTURED     (provider captures — webhook)
 *   CAPTURED   → REFUNDED     (refund processed — webhook or explicit call)
 *   AUTHORIZED → CANCELLED    (intent cancelled)
 *
 * Terminal statuses: CAPTURED, FAILED, REFUNDED, CANCELLED
 */
import { PaymentStatus } from '@airbus-tools/shared';
interface PaymentTransition {
    from: PaymentStatus;
    to: PaymentStatus;
}
export declare const PAYMENT_TRANSITIONS: PaymentTransition[];
/**
 * Terminal statuses — no further transitions are possible.
 * NOTE: CAPTURED is intentionally NOT terminal — a captured payment can be
 * refunded, so it has one valid outbound edge (CAPTURED → REFUNDED).
 */
export declare const PAYMENT_TERMINAL_STATUSES: Set<PaymentStatus>;
export declare function isPaymentTerminal(status: PaymentStatus): boolean;
/**
 * Assert a payment transition is valid.
 * Throws an AppError if the transition is illegal or the payment is terminal.
 * No-ops (same status) are allowed for idempotency.
 */
export declare function assertPaymentTransition(current: PaymentStatus, next: PaymentStatus): void;
export {};
//# sourceMappingURL=paymentStateMachine.d.ts.map