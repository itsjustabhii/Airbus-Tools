"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = exports.EmailService = exports.processedJobIds = void 0;
const env_1 = require("../../config/env");
const logger_1 = require("../../core/logger");
const LocalEmailAdapter_1 = require("./LocalEmailAdapter");
const SesEmailAdapter_1 = require("./SesEmailAdapter");
const templates_1 = require("./templates");
// ── Adapter factory ───────────────────────────────────────────────────────────
function createDefaultAdapter() {
    if (env_1.config.NODE_ENV === 'production') {
        return new SesEmailAdapter_1.SesEmailAdapter();
    }
    return new LocalEmailAdapter_1.LocalEmailAdapter();
}
// ── Idempotency store (in-process) ────────────────────────────────────────────
/**
 * Set of job IDs that have already been processed.
 * Exported for testing (allows manual clearing between test cases).
 */
exports.processedJobIds = new Set();
// ── Service ───────────────────────────────────────────────────────────────────
class EmailService {
    adapter;
    from;
    replyTo;
    constructor(adapter) {
        this.adapter = adapter ?? createDefaultAdapter();
        this.from = env_1.config.SES_FROM_ADDRESS;
        this.replyTo = env_1.config.SES_REPLY_TO;
    }
    /**
     * Sends an email corresponding to the supplied job data.
     *
     * @throws if the adapter rejects (caller / worker should handle retries).
     */
    async send(data) {
        const log = logger_1.logger.child({ service: 'EmailService', jobId: data.jobId, name: data.name });
        // ── Idempotency guard ────────────────────────────────────────────────────
        if (exports.processedJobIds.has(data.jobId)) {
            log.warn('Email job already processed — skipping (idempotency)');
            return;
        }
        // ── Render template ──────────────────────────────────────────────────────
        let rendered;
        let to;
        switch (data.name) {
            case 'send-welcome':
                to = data.to;
                rendered = (0, templates_1.renderWelcome)({ recipientName: data.recipientName, userId: data.userId });
                break;
            case 'send-order-request':
                to = data.to;
                rendered = (0, templates_1.renderOrderRequest)({
                    recipientName: data.recipientName,
                    orderNumber: data.orderNumber,
                    orderId: data.orderId,
                    totalAmount: data.totalAmount,
                    currency: data.currency,
                });
                break;
            case 'send-order-accepted':
                to = data.to;
                rendered = (0, templates_1.renderOrderAccepted)({
                    recipientName: data.recipientName,
                    orderNumber: data.orderNumber,
                    orderId: data.orderId,
                    totalAmount: data.totalAmount,
                    currency: data.currency,
                });
                break;
            case 'send-order-rejected':
                to = data.to;
                rendered = (0, templates_1.renderOrderRejected)({
                    recipientName: data.recipientName,
                    orderNumber: data.orderNumber,
                    orderId: data.orderId,
                    rejectionReason: data.rejectionReason,
                });
                break;
            case 'send-payment-confirmation':
                to = data.to;
                rendered = (0, templates_1.renderPaymentConfirmation)({
                    recipientName: data.recipientName,
                    paymentNumber: data.paymentNumber,
                    paymentId: data.paymentId,
                    orderId: data.orderId,
                    orderNumber: data.orderNumber,
                    amount: data.amount,
                    currency: data.currency,
                });
                break;
            case 'send-password-changed':
                to = data.to;
                rendered = (0, templates_1.renderPasswordChanged)({
                    recipientName: data.recipientName,
                    userId: data.userId,
                    changedAt: data.changedAt,
                });
                break;
            case 'send-notification':
                to = data.to;
                rendered = (0, templates_1.renderNotification)({
                    recipientName: data.recipientName,
                    subject: data.subject,
                    message: data.message,
                    ...(data.referenceType !== undefined ? { referenceType: data.referenceType } : {}),
                    ...(data.referenceId !== undefined ? { referenceId: data.referenceId } : {}),
                });
                break;
            // ── Legacy Phase-8 job names ─────────────────────────────────────────
            case 'send-order-confirmation':
                to = data.to;
                rendered = (0, templates_1.renderOrderAccepted)({
                    recipientName: data.recipientName,
                    orderNumber: data.orderNumber,
                    orderId: data.orderId,
                    totalAmount: data.totalAmount,
                    currency: data.currency,
                });
                break;
            case 'send-order-status-update':
                to = data.to;
                if (data.newStatus === 'REJECTED') {
                    rendered = (0, templates_1.renderOrderRejected)({
                        recipientName: data.recipientName,
                        orderNumber: data.orderNumber,
                        orderId: data.orderId,
                        rejectionReason: data.rejectionReason ?? 'No reason provided',
                    });
                }
                else {
                    rendered = (0, templates_1.renderNotification)({
                        recipientName: data.recipientName,
                        subject: `Order ${data.orderNumber} status updated to ${data.newStatus}`,
                        message: `Your order ${data.orderNumber} has moved from ${data.previousStatus} to ${data.newStatus}.`,
                        referenceType: 'order',
                        referenceId: data.orderId,
                    });
                }
                break;
            case 'send-payment-receipt':
                to = data.to;
                rendered = (0, templates_1.renderPaymentConfirmation)({
                    recipientName: data.recipientName,
                    paymentNumber: data.paymentNumber,
                    paymentId: data.paymentId,
                    orderId: data.orderId,
                    orderNumber: data.orderId, // legacy — orderId used as order number
                    amount: data.amount,
                    currency: data.currency,
                });
                break;
            case 'send-reminder':
                to = data.to;
                rendered = (0, templates_1.renderNotification)({
                    recipientName: data.recipientName,
                    subject: data.subject,
                    message: data.body,
                    referenceType: data.referenceType,
                    referenceId: data.referenceId,
                });
                break;
            default: {
                const unknownName = data.name;
                log.error({ unknownJobName: unknownName }, 'Unknown email job name — cannot render template');
                throw new Error(`Unknown email job name: ${unknownName}`);
            }
        }
        log.info({ to, subject: rendered.subject }, 'Dispatching email');
        // ── Send via adapter ─────────────────────────────────────────────────────
        const result = await this.adapter.send({
            to,
            from: this.from,
            ...(this.replyTo !== undefined ? { replyTo: this.replyTo } : {}),
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            idempotencyKey: data.jobId,
        });
        // ── Mark processed ───────────────────────────────────────────────────────
        exports.processedJobIds.add(data.jobId);
        log.info({ to, subject: rendered.subject, messageId: result.messageId }, 'Email sent successfully');
    }
}
exports.EmailService = EmailService;
// Singleton for production / dev use; tests inject their own instance.
exports.emailService = new EmailService();
//# sourceMappingURL=EmailService.js.map