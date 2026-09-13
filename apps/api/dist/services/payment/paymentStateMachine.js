"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_TERMINAL_STATUSES = exports.PAYMENT_TRANSITIONS = void 0;
exports.isPaymentTerminal = isPaymentTerminal;
exports.assertPaymentTransition = assertPaymentTransition;
const shared_1 = require("@airbus-tools/shared");
const errors_1 = require("../../core/errors");
exports.PAYMENT_TRANSITIONS = [
    { from: shared_1.PaymentStatus.PENDING, to: shared_1.PaymentStatus.AUTHORIZED },
    { from: shared_1.PaymentStatus.PENDING, to: shared_1.PaymentStatus.CAPTURED }, // some providers skip AUTHORIZED
    { from: shared_1.PaymentStatus.PENDING, to: shared_1.PaymentStatus.FAILED },
    { from: shared_1.PaymentStatus.AUTHORIZED, to: shared_1.PaymentStatus.CAPTURED },
    { from: shared_1.PaymentStatus.AUTHORIZED, to: shared_1.PaymentStatus.FAILED },
    { from: shared_1.PaymentStatus.AUTHORIZED, to: shared_1.PaymentStatus.CANCELLED },
    { from: shared_1.PaymentStatus.CAPTURED, to: shared_1.PaymentStatus.REFUNDED },
];
const paymentTransitionSet = new Set(exports.PAYMENT_TRANSITIONS.map((t) => `${t.from}→${t.to}`));
/**
 * Terminal statuses — no further transitions are possible.
 * NOTE: CAPTURED is intentionally NOT terminal — a captured payment can be
 * refunded, so it has one valid outbound edge (CAPTURED → REFUNDED).
 */
exports.PAYMENT_TERMINAL_STATUSES = new Set([
    shared_1.PaymentStatus.FAILED,
    shared_1.PaymentStatus.REFUNDED,
    shared_1.PaymentStatus.CANCELLED,
]);
function isPaymentTerminal(status) {
    return exports.PAYMENT_TERMINAL_STATUSES.has(status);
}
/**
 * Assert a payment transition is valid.
 * Throws an AppError if the transition is illegal or the payment is terminal.
 * No-ops (same status) are allowed for idempotency.
 */
function assertPaymentTransition(current, next) {
    if (current === next)
        return; // idempotent no-op
    if (isPaymentTerminal(current)) {
        throw new errors_1.AppError(`Payment is in terminal state ${current} and cannot transition to ${next}`, 409, 'INVALID_TRANSITION');
    }
    const key = `${current}→${next}`;
    if (!paymentTransitionSet.has(key)) {
        throw new errors_1.AppError(`Invalid payment state transition: ${current} → ${next}`, 409, 'INVALID_TRANSITION');
    }
}
//# sourceMappingURL=paymentStateMachine.js.map