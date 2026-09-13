import { OrderStatus, UserRole } from '@airbus-tools/shared';
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
 *   webhook confirms     → PAID              (internal only — no frontend path)
 *   SUPPLIER marks done  → COMPLETED         (terminal)
 *
 * NOTE: PAYMENT_PENDING → PAID is intentionally NOT exposed via the HTTP state
 * machine to human callers.  Only the payment webhook handler may advance an
 * order to PAID, enforcing that payment confirmation is always provider-authoritative.
 */
export declare const VALID_TRANSITIONS: Transition[];
/**
 * Asserts that the requested transition is valid and the caller has permission.
 * Throws an AppError with a descriptive message for any violation.
 */
export declare function assertTransition(current: OrderStatus, next: OrderStatus, callerRole: UserRole): void;
/**
 * Returns all statuses reachable from `current` for the given role.
 * Used to advertise available actions on an order.
 */
export declare function availableTransitions(current: OrderStatus, callerRole: UserRole): OrderStatus[];
/** Terminal statuses — an order in these states cannot be modified at all. */
export declare const TERMINAL_STATUSES: Set<OrderStatus>;
export declare function isTerminal(status: OrderStatus): boolean;
//# sourceMappingURL=orderStateMachine.d.ts.map