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

import { AppError } from '../../core/errors';

interface PaymentTransition {
  from: PaymentStatus;
  to: PaymentStatus;
}

export const PAYMENT_TRANSITIONS: PaymentTransition[] = [
  { from: PaymentStatus.PENDING,    to: PaymentStatus.AUTHORIZED },
  { from: PaymentStatus.PENDING,    to: PaymentStatus.CAPTURED   },  // some providers skip AUTHORIZED
  { from: PaymentStatus.PENDING,    to: PaymentStatus.FAILED     },
  { from: PaymentStatus.AUTHORIZED, to: PaymentStatus.CAPTURED   },
  { from: PaymentStatus.AUTHORIZED, to: PaymentStatus.FAILED     },
  { from: PaymentStatus.AUTHORIZED, to: PaymentStatus.CANCELLED  },
  { from: PaymentStatus.CAPTURED,   to: PaymentStatus.REFUNDED   },
];

const paymentTransitionSet = new Set<string>(
  PAYMENT_TRANSITIONS.map((t) => `${t.from}→${t.to}`),
);

/**
 * Terminal statuses — no further transitions are possible.
 * NOTE: CAPTURED is intentionally NOT terminal — a captured payment can be
 * refunded, so it has one valid outbound edge (CAPTURED → REFUNDED).
 */
export const PAYMENT_TERMINAL_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
  PaymentStatus.CANCELLED,
]);

export function isPaymentTerminal(status: PaymentStatus): boolean {
  return PAYMENT_TERMINAL_STATUSES.has(status);
}

/**
 * Assert a payment transition is valid.
 * Throws an AppError if the transition is illegal or the payment is terminal.
 * No-ops (same status) are allowed for idempotency.
 */
export function assertPaymentTransition(current: PaymentStatus, next: PaymentStatus): void {
  if (current === next) return; // idempotent no-op

  if (isPaymentTerminal(current)) {
    throw new AppError(
      `Payment is in terminal state ${current} and cannot transition to ${next}`,
      409,
      'INVALID_TRANSITION',
    );
  }

  const key = `${current}→${next}`;
  if (!paymentTransitionSet.has(key)) {
    throw new AppError(
      `Invalid payment state transition: ${current} → ${next}`,
      409,
      'INVALID_TRANSITION',
    );
  }
}
