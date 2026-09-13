"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailQueue = getEmailQueue;
exports.getNotificationsQueue = getNotificationsQueue;
exports.getPaymentQueue = getPaymentQueue;
exports.getMaintenanceQueue = getMaintenanceQueue;
exports.closeAllQueues = closeAllQueues;
exports.newJobId = newJobId;
exports.enqueueEmail = enqueueEmail;
exports.enqueueNotification = enqueueNotification;
exports.enqueuePayment = enqueuePayment;
exports.enqueueMaintenance = enqueueMaintenance;
/**
 * BullMQ queue instances.
 *
 * All four queues share:
 *   - exponential back-off retry policy (3 attempts, 2 s base, ×2 factor)
 *   - job-ID derived from the caller-supplied `jobId` field for idempotency
 *   - 30-day retention for completed/failed jobs (for audit logging)
 *
 * Queues are singletons — call getQueue*() from any module without creating
 * duplicate connections.
 */
const bullmq_1 = require("bullmq");
const uuid_1 = require("uuid");
const env_1 = require("../config/env");
const logger_1 = require("../core/logger");
/** True when running under the test runner — queues become no-ops to avoid needing Redis. */
const IS_TEST = env_1.config.NODE_ENV === 'test';
const redis_1 = require("./redis");
const types_1 = require("./types");
// ── Shared defaults ───────────────────────────────────────────────────────────
/**
 * Default job options applied to every job unless overridden at enqueue time.
 *
 * Retry policy:
 *   attempt 1 → immediate
 *   attempt 2 → 2 s
 *   attempt 3 → 4 s
 *   (base 2_000 ms, exponential factor 2)
 */
const DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2_000,
    },
    removeOnComplete: {
        // Keep last 500 completed jobs per queue for observability
        count: 500,
        // …but never older than 30 days
        age: 30 * 24 * 60 * 60,
    },
    removeOnFail: {
        // Keep last 200 failed jobs for debugging
        count: 200,
        age: 30 * 24 * 60 * 60,
    },
};
// ── Queue singletons ──────────────────────────────────────────────────────────
let emailQueue = null;
let notificationsQueue = null;
let paymentQueue = null;
let maintenanceQueue = null;
function getEmailQueue() {
    if (!emailQueue) {
        emailQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.EMAIL, {
            connection: redis_1.bullMQConnection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        if (!IS_TEST)
            logger_1.logger.info({ queue: types_1.QUEUE_NAMES.EMAIL }, '📬 Email queue initialized');
    }
    return emailQueue;
}
function getNotificationsQueue() {
    if (!notificationsQueue) {
        notificationsQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.NOTIFICATIONS, {
            connection: redis_1.bullMQConnection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        if (!IS_TEST)
            logger_1.logger.info({ queue: types_1.QUEUE_NAMES.NOTIFICATIONS }, '🔔 Notifications queue initialized');
    }
    return notificationsQueue;
}
function getPaymentQueue() {
    if (!paymentQueue) {
        paymentQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.PAYMENT, {
            connection: redis_1.bullMQConnection,
            defaultJobOptions: {
                ...DEFAULT_JOB_OPTIONS,
                // Payment jobs are higher-value — keep more history
                removeOnComplete: { count: 1_000, age: 90 * 24 * 60 * 60 },
                removeOnFail: { count: 1_000, age: 90 * 24 * 60 * 60 },
            },
        });
        if (!IS_TEST)
            logger_1.logger.info({ queue: types_1.QUEUE_NAMES.PAYMENT }, '💳 Payment queue initialized');
    }
    return paymentQueue;
}
function getMaintenanceQueue() {
    if (!maintenanceQueue) {
        maintenanceQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.MAINTENANCE, {
            connection: redis_1.bullMQConnection,
            defaultJobOptions: {
                ...DEFAULT_JOB_OPTIONS,
                // Maintenance / scheduler jobs: only 1 attempt (they will be
                // re-scheduled on the next cron tick anyway)
                attempts: 1,
            },
        });
        if (!IS_TEST)
            logger_1.logger.info({ queue: types_1.QUEUE_NAMES.MAINTENANCE }, '🔧 Maintenance queue initialized');
    }
    return maintenanceQueue;
}
// ── Close all queues (called during graceful shutdown) ────────────────────────
async function closeAllQueues() {
    const queues = [emailQueue, notificationsQueue, paymentQueue, maintenanceQueue].filter(Boolean);
    await Promise.allSettled(queues.map((q) => q.close()));
    emailQueue = null;
    notificationsQueue = null;
    paymentQueue = null;
    maintenanceQueue = null;
    logger_1.logger.info('All BullMQ queues closed');
}
// ── Typed enqueue helpers ─────────────────────────────────────────────────────
/**
 * Generates a stable BullMQ job ID from the caller-supplied `jobId`.
 * Using the same `jobId` prevents duplicate jobs when a message is retried
 * at the HTTP layer before it reaches the queue (idempotency key pattern).
 */
function jobIdFromData(data) {
    return data.jobId;
}
/** Generate a fresh job ID (UUID v4). */
function newJobId() {
    return (0, uuid_1.v4)();
}
/**
 * Enqueue an email job.
 * The `jobId` in `data` is used as the BullMQ job ID for deduplication.
 */
async function enqueueEmail(data, opts) {
    if (IS_TEST)
        return;
    const queue = getEmailQueue();
    const job = await queue.add(data.name, data, {
        jobId: jobIdFromData(data),
        ...(opts?.delay !== undefined ? { delay: opts.delay } : {}),
    });
    logger_1.logger.info({ queue: types_1.QUEUE_NAMES.EMAIL, jobId: job.id, name: data.name }, 'Email job enqueued');
}
/**
 * Enqueue a notification job.
 */
async function enqueueNotification(data, opts) {
    if (IS_TEST)
        return;
    const queue = getNotificationsQueue();
    const job = await queue.add(data.name, data, {
        jobId: jobIdFromData(data),
        ...(opts?.delay !== undefined ? { delay: opts.delay } : {}),
    });
    logger_1.logger.info({ queue: types_1.QUEUE_NAMES.NOTIFICATIONS, jobId: job.id, name: data.name }, 'Notification job enqueued');
}
/**
 * Enqueue a payment job.
 */
async function enqueuePayment(data, opts) {
    if (IS_TEST)
        return;
    const queue = getPaymentQueue();
    const job = await queue.add(data.name, data, {
        jobId: jobIdFromData(data),
        ...(opts?.delay !== undefined ? { delay: opts.delay } : {}),
        ...(opts?.priority !== undefined ? { priority: opts.priority } : {}),
    });
    logger_1.logger.info({ queue: types_1.QUEUE_NAMES.PAYMENT, jobId: job.id, name: data.name }, 'Payment job enqueued');
}
/**
 * Enqueue a maintenance job (typically called by the scheduler).
 */
async function enqueueMaintenance(data) {
    if (IS_TEST)
        return;
    const queue = getMaintenanceQueue();
    const job = await queue.add(data.name, data, {
        jobId: jobIdFromData(data),
    });
    logger_1.logger.info({ queue: types_1.QUEUE_NAMES.MAINTENANCE, jobId: job.id, name: data.name }, 'Maintenance job enqueued');
}
//# sourceMappingURL=queues.js.map