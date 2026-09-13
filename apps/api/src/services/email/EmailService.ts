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

import { config } from '../../config/env';
import { logger } from '../../core/logger';
import type { EmailJobData } from '../../jobs/types';
import type { IEmailAdapter } from './IEmailAdapter';
import { LocalEmailAdapter } from './LocalEmailAdapter';
import { SesEmailAdapter } from './SesEmailAdapter';
import {
  renderWelcome,
  renderOrderRequest,
  renderOrderAccepted,
  renderOrderRejected,
  renderPaymentConfirmation,
  renderPasswordChanged,
  renderNotification,
  type RenderedEmail,
} from './templates';

// ── Adapter factory ───────────────────────────────────────────────────────────

function createDefaultAdapter(): IEmailAdapter {
  if (config.NODE_ENV === 'production') {
    return new SesEmailAdapter();
  }
  return new LocalEmailAdapter();
}

// ── Idempotency store (in-process) ────────────────────────────────────────────

/**
 * Set of job IDs that have already been processed.
 * Exported for testing (allows manual clearing between test cases).
 */
export const processedJobIds = new Set<string>();

// ── Service ───────────────────────────────────────────────────────────────────

export class EmailService {
  private readonly adapter: IEmailAdapter;
  private readonly from: string;
  private readonly replyTo: string | undefined;

  constructor(adapter?: IEmailAdapter) {
    this.adapter = adapter ?? createDefaultAdapter();
    this.from = config.SES_FROM_ADDRESS;
    this.replyTo = config.SES_REPLY_TO;
  }

  /**
   * Sends an email corresponding to the supplied job data.
   *
   * @throws if the adapter rejects (caller / worker should handle retries).
   */
  async send(data: EmailJobData): Promise<void> {
    const log = logger.child({ service: 'EmailService', jobId: data.jobId, name: data.name });

    // ── Idempotency guard ────────────────────────────────────────────────────
    if (processedJobIds.has(data.jobId)) {
      log.warn('Email job already processed — skipping (idempotency)');
      return;
    }

    // ── Render template ──────────────────────────────────────────────────────
    let rendered: RenderedEmail;
    let to: string;

    switch (data.name) {
      case 'send-welcome':
        to = data.to;
        rendered = renderWelcome({ recipientName: data.recipientName, userId: data.userId });
        break;

      case 'send-order-request':
        to = data.to;
        rendered = renderOrderRequest({
          recipientName: data.recipientName,
          orderNumber: data.orderNumber,
          orderId: data.orderId,
          totalAmount: data.totalAmount,
          currency: data.currency,
        });
        break;

      case 'send-order-accepted':
        to = data.to;
        rendered = renderOrderAccepted({
          recipientName: data.recipientName,
          orderNumber: data.orderNumber,
          orderId: data.orderId,
          totalAmount: data.totalAmount,
          currency: data.currency,
        });
        break;

      case 'send-order-rejected':
        to = data.to;
        rendered = renderOrderRejected({
          recipientName: data.recipientName,
          orderNumber: data.orderNumber,
          orderId: data.orderId,
          rejectionReason: data.rejectionReason,
        });
        break;

      case 'send-payment-confirmation':
        to = data.to;
        rendered = renderPaymentConfirmation({
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
        rendered = renderPasswordChanged({
          recipientName: data.recipientName,
          userId: data.userId,
          changedAt: data.changedAt,
        });
        break;

      case 'send-notification':
        to = data.to;
        rendered = renderNotification({
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
        rendered = renderOrderAccepted({
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
          rendered = renderOrderRejected({
            recipientName: data.recipientName,
            orderNumber: data.orderNumber,
            orderId: data.orderId,
            rejectionReason: data.rejectionReason ?? 'No reason provided',
          });
        } else {
          rendered = renderNotification({
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
        rendered = renderPaymentConfirmation({
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
        rendered = renderNotification({
          recipientName: data.recipientName,
          subject: data.subject,
          message: data.body,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
        });
        break;

      default: {
        const unknownName = (data as { name: string }).name;
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
    processedJobIds.add(data.jobId);

    log.info({ to, subject: rendered.subject, messageId: result.messageId }, 'Email sent successfully');
  }
}

// Singleton for production / dev use; tests inject their own instance.
export const emailService = new EmailService();
