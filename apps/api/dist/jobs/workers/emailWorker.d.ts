import { Worker } from 'bullmq';
import type { EmailJobData, EmailJobName } from '../types';
/**
 * Creates and returns a BullMQ Worker for the email queue.
 *
 * The worker begins polling as soon as it is instantiated.
 * Exponential back-off retry policy is configured on the Queue's
 * defaultJobOptions — no need to repeat it here.
 */
export declare function createEmailWorker(): Worker<EmailJobData, void, EmailJobName>;
//# sourceMappingURL=emailWorker.d.ts.map