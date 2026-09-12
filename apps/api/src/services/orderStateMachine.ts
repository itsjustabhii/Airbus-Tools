import { OrderStatus, UserRole } from '@airbus-tools/shared';

import { AppError } from '../core/errors';

/**
 * Describes a valid state transition: who can trigger it, and what the
 * resulting status is.
 */
export interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  /** Roles permitted to trigger this transition */
  allowedRoles: UserRole[];
}

/**
 * Exhaustive list of every valid state transition in the order lifecycle.
 *
 * Lifecycle:
 *   AIRLINE submits      → PENDING
 *   SUPPLIER accepts     → ACCEPTED
 *   SUPPLIER rejects     → REJECTED          (terminal)
 *   AIRLINE initiates    → PAYMENT_PENDING
 *   AIRLINE confirms pay → PAID
 *   SUPPLIER marks done  → COMPLETED         (terminal)
 */
export const VALID_TRANSITIONS: Transition[] = [
  // Supplier decisions on a new request
  { from: OrderStatus.PENDING,         to: OrderStatus.ACCEPTED,        allowedRoles: [UserRole.SUPPLIER, UserRole.ADMIN] },
  { from: OrderStatus.PENDING,         to: OrderStatus.REJECTED,        allowedRoles: [UserRole.SUPPLIER, UserRole.ADMIN] },

  // Airline advances to payment after acceptance
  { from: OrderStatus.ACCEPTED,        to: OrderStatus.PAYMENT_PENDING, allowedRoles: [UserRole.AIRLINE, UserRole.ADMIN] },

  // Airline confirms payment
  { from: OrderStatus.PAYMENT_PENDING, to: OrderStatus.PAID,            allowedRoles: [UserRole.AIRLINE, UserRole.ADMIN] },

  // Supplier marks order as completed once fulfilled
  { from: OrderStatus.PAID,            to: OrderStatus.COMPLETED,       allowedRoles: [UserRole.SUPPLIER, UserRole.ADMIN] },
];

// Build a fast lookup: "from→to" → Transition
const transitionMap = new Map<string, Transition>(
  VALID_TRANSITIONS.map((t) => [`${t.from}→${t.to}`, t]),
);

function transitionKey(from: OrderStatus, to: OrderStatus): string {
  return `${from}→${to}`;
}

/**
 * Asserts that the requested transition is valid and the caller has permission.
 * Throws an AppError with a descriptive message for any violation.
 */
export function assertTransition(
  current: OrderStatus,
  next: OrderStatus,
  callerRole: UserRole,
): void {
  const key = transitionKey(current, next);
  const transition = transitionMap.get(key);

  if (!transition) {
    throw new AppError(
      `Invalid state transition: ${current} → ${next}`,
      409,
      'INVALID_TRANSITION',
    );
  }

  if (!transition.allowedRoles.includes(callerRole)) {
    throw new AppError(
      `Role ${callerRole} is not permitted to transition an order from ${current} to ${next}`,
      403,
      'FORBIDDEN',
    );
  }
}

/**
 * Returns all statuses reachable from `current` for the given role.
 * Used to advertise available actions on an order.
 */
export function availableTransitions(
  current: OrderStatus,
  callerRole: UserRole,
): OrderStatus[] {
  return VALID_TRANSITIONS
    .filter((t) => t.from === current && t.allowedRoles.includes(callerRole))
    .map((t) => t.to);
}

/** Terminal statuses — an order in these states cannot be modified at all. */
export const TERMINAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.REJECTED,
  OrderStatus.COMPLETED,
]);

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
