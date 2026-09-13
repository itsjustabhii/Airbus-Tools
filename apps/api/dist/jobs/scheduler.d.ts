/**
 * Register all recurring cron jobs in the maintenance queue.
 *
 * BullMQ deduplicates repeatable jobs by their `repeatJobKey` so calling this
 * function on every worker start is safe — no duplicate schedules are created.
 */
export declare function setupScheduledJobs(): Promise<void>;
/**
 * Remove all registered cron schedules (used during graceful shutdown / tests).
 */
export declare function teardownScheduledJobs(): Promise<void>;
//# sourceMappingURL=scheduler.d.ts.map