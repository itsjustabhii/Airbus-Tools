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
import { Queue } from 'bullmq';
import type { EmailJobData, EmailJobName, MaintenanceJobData, MaintenanceJobName, NotificationJobData, NotificationJobName, PaymentJobData, PaymentJobName } from './types';
export declare function getEmailQueue(): Queue<EmailJobData, void, EmailJobName>;
export declare function getNotificationsQueue(): Queue<NotificationJobData, void, NotificationJobName>;
export declare function getPaymentQueue(): Queue<PaymentJobData, void, PaymentJobName>;
export declare function getMaintenanceQueue(): Queue<MaintenanceJobData, void, MaintenanceJobName>;
export declare function closeAllQueues(): Promise<void>;
/** Generate a fresh job ID (UUID v4). */
export declare function newJobId(): string;
/**
 * Enqueue an email job.
 * The `jobId` in `data` is used as the BullMQ job ID for deduplication.
 */
export declare function enqueueEmail(data: EmailJobData, opts?: {
    delay?: number;
}): Promise<void>;
/**
 * Enqueue a notification job.
 */
export declare function enqueueNotification(data: NotificationJobData, opts?: {
    delay?: number;
}): Promise<void>;
/**
 * Enqueue a payment job.
 */
export declare function enqueuePayment(data: PaymentJobData, opts?: {
    delay?: number;
    priority?: number;
}): Promise<void>;
/**
 * Enqueue a maintenance job (typically called by the scheduler).
 */
export declare function enqueueMaintenance(data: MaintenanceJobData): Promise<void>;
//# sourceMappingURL=queues.d.ts.map