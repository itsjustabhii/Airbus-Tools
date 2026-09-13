/**
 * EmailService — central email abstraction (Phase 9).
 *
 * Responsibilities:
 *  1. Translate a typed EmailJobData payload into a rendered email (subject + html + text).
 *  2. Forward the rendered output to the configured IEmailAdapter.
 *  3. Apply idempotency: a job that has already been processed (same jobId) is
 *     silently skipped after logging a warning.
 *  4. Emit structured log events on every lifecycle step.
 *
 * Adapter selection (automatic, can be overridden for testing):
 *  - NODE_ENV === 'production'  → SesEmailAdapter
 *  - NODE_ENV === 'test'        → LocalEmailAdapter (no real sends)
 *  - otherwise (development)   → LocalEmailAdapter
 *
 * Idempotency store:
 *  The processed-jobId set lives in-process (a plain Set<string>).  For a
 *  horizontally-scaled deployment this should be replaced with a Redis SET
 *  using SETNX / TTL.  The worker already has a Redis connection so the
 *  upgrade path is straightforward.
 */
import type { EmailJobData } from '../../jobs/types';
import type { IEmailAdapter } from './IEmailAdapter';
/**
 * Set of job IDs that have already been processed.
 * Exported for testing (allows manual clearing between test cases).
 */
export declare const processedJobIds: Set<string>;
export declare class EmailService {
    private readonly adapter;
    private readonly from;
    private readonly replyTo;
    constructor(adapter?: IEmailAdapter);
    /**
     * Sends an email corresponding to the supplied job data.
     *
     * @throws if the adapter rejects (caller / worker should handle retries).
     */
    send(data: EmailJobData): Promise<void>;
}
export declare const emailService: EmailService;
//# sourceMappingURL=EmailService.d.ts.map