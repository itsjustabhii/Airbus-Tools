"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERMINAL_STATUSES = exports.VALID_TRANSITIONS = void 0;
exports.assertTransition = assertTransition;
exports.availableTransitions = availableTransitions;
exports.isTerminal = isTerminal;
const shared_1 = require("@airbus-tools/shared");
const errors_1 = require("../core/errors");
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
exports.VALID_TRANSITIONS = [
    // Supplier decisions on a new request
    { from: shared_1.OrderStatus.PENDING, to: shared_1.OrderStatus.ACCEPTED, allowedRoles: [shared_1.UserRole.SUPPLIER, shared_1.UserRole.ADMIN] },
    { from: shared_1.OrderStatus.PENDING, to: shared_1.OrderStatus.REJECTED, allowedRoles: [shared_1.UserRole.SUPPLIER, shared_1.UserRole.ADMIN] },
    // Airline advances to payment after acceptance
    { from: shared_1.OrderStatus.ACCEPTED, to: shared_1.OrderStatus.PAYMENT_PENDING, allowedRoles: [shared_1.UserRole.AIRLINE, shared_1.UserRole.ADMIN] },
    // PAYMENT_PENDING → PAID is NOT in this list on purpose.
    // It is performed internally by the webhook handler and is not callable
    // via the public /orders/:id/status endpoint.
    // Supplier marks order as completed once fulfilled
    { from: shared_1.OrderStatus.PAID, to: shared_1.OrderStatus.COMPLETED, allowedRoles: [shared_1.UserRole.SUPPLIER, shared_1.UserRole.ADMIN] },
];
// Build a fast lookup: "from→to" → Transition
const transitionMap = new Map(exports.VALID_TRANSITIONS.map((t) => [`${t.from}→${t.to}`, t]));
function transitionKey(from, to) {
    return `${from}→${to}`;
}
/**
 * Asserts that the requested transition is valid and the caller has permission.
 * Throws an AppError with a descriptive message for any violation.
 */
function assertTransition(current, next, callerRole) {
    const key = transitionKey(current, next);
    const transition = transitionMap.get(key);
    if (!transition) {
        throw new errors_1.AppError(`Invalid state transition: ${current} → ${next}`, 409, 'INVALID_TRANSITION');
    }
    if (!transition.allowedRoles.includes(callerRole)) {
        throw new errors_1.AppError(`Role ${callerRole} is not permitted to transition an order from ${current} to ${next}`, 403, 'FORBIDDEN');
    }
}
/**
 * Returns all statuses reachable from `current` for the given role.
 * Used to advertise available actions on an order.
 */
function availableTransitions(current, callerRole) {
    return exports.VALID_TRANSITIONS
        .filter((t) => t.from === current && t.allowedRoles.includes(callerRole))
        .map((t) => t.to);
}
/** Terminal statuses — an order in these states cannot be modified at all. */
exports.TERMINAL_STATUSES = new Set([
    shared_1.OrderStatus.REJECTED,
    shared_1.OrderStatus.COMPLETED,
]);
function isTerminal(status) {
    return exports.TERMINAL_STATUSES.has(status);
}
//# sourceMappingURL=orderStateMachine.js.map