"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmailWorker = createEmailWorker;
const bullmq_1 = require("bullmq");
const logger_1 = require("../../core/logger");
const EmailService_1 = require("../../services/email/EmailService");
const redis_1 = require("../redis");
const types_1 = require("../types");
// ── Main processor ────────────────────────────────────────────────────────────
async function processEmail(job) {
    const { data } = job;
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.EMAIL,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        attempt: job.attemptsMade,
    });
    log.info('Processing email job');
    await EmailService_1.emailService.send(data);
    log.info('Email job completed successfully');
}
// ── Worker factory ────────────────────────────────────────────────────────────
/**
 * Creates and returns a BullMQ Worker for the email queue.
 *
 * The worker begins polling as soon as it is instantiated.
 * Exponential back-off retry policy is configured on the Queue's
 * defaultJobOptions — no need to repeat it here.
 */
function createEmailWorker() {
    const worker = new bullmq_1.Worker(types_1.QUEUE_NAMES.EMAIL, processEmail, {
        connection: redis_1.bullMQConnection,
        concurrency: 5,
    });
    worker.on('completed', (job) => {
        logger_1.logger.info({
            queue: types_1.QUEUE_NAMES.EMAIL,
            jobId: job.data.jobId,
            bullJobId: job.id,
            name: job.name,
            durationMs: job.processedOn ? Date.now() - job.processedOn : null,
        }, '✅ Email job completed');
    });
    worker.on('failed', (job, err) => {
        logger_1.logger.error({
            queue: types_1.QUEUE_NAMES.EMAIL,
            jobId: job?.data?.jobId,
            bullJobId: job?.id,
            name: job?.name,
            attempt: job?.attemptsMade,
            err,
        }, '❌ Email job failed');
    });
    worker.on('error', (err) => {
        logger_1.logger.error({ queue: types_1.QUEUE_NAMES.EMAIL, err }, 'Email worker error');
    });
    logger_1.logger.info({ queue: types_1.QUEUE_NAMES.EMAIL }, '👷 Email worker started');
    return worker;
}
//# sourceMappingURL=emailWorker.js.map