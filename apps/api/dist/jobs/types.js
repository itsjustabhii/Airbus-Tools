"use strict";
/**
 * Strongly-typed job data interfaces for all BullMQ queues.
 *
 * Every job carries a `jobId` (UUID v4) generated at enqueue-time so that
 * handlers can implement idempotency: if a job has already been processed,
 * the handler returns early without side-effects.
 *
 * Each queue is a discriminated union of job names + payloads so the
 * queue-level Queue<T> / Worker<T> generic stays fully type-safe.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_NAMES = void 0;
// ── Queue name registry ───────────────────────────────────────────────────────
exports.QUEUE_NAMES = {
    EMAIL: 'email',
    NOTIFICATIONS: 'notifications',
    PAYMENT: 'payment',
    MAINTENANCE: 'maintenance',
};
//# sourceMappingURL=types.js.map