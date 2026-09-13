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

import { NotificationType, OrderStatus, PaymentStatus } from '@airbus-tools/shared';

// ── Common ───────────────────────────────────────────────────────────────────

/** Identifies the exact job and enables idempotency checks. */
export interface BaseJobData {
  /** UUID v4 — generated before enqueueing, stored on the job. */
  jobId: string;
}

// ── Email queue ───────────────────────────────────────────────────────────────

export type EmailJobName =
  | 'send-welcome'
  | 'send-order-request'
  | 'send-order-accepted'
  | 'send-order-rejected'
  | 'send-payment-confirmation'
  | 'send-password-changed'
  | 'send-notification'
  // Legacy names — kept for backward-compat during rollout
  | 'send-order-confirmation'
  | 'send-order-status-update'
  | 'send-payment-receipt'
  | 'send-reminder';

// ── New typed payloads ────────────────────────────────────────────────────────

export interface SendWelcomeData extends BaseJobData {
  to: string;
  recipientName: string;
  userId: string;
}

export interface SendOrderRequestData extends BaseJobData {
  to: string;
  recipientName: string;
  orderNumber: string;
  orderId: string;
  totalAmount: number;
  currency: string;
  /** Supplier's email — also notified of the new incoming order. */
  supplierTo: string;
  supplierName: string;
}

export interface SendOrderAcceptedData extends BaseJobData {
  to: string;
  recipientName: string;
  orderNumber: string;
  orderId: string;
  totalAmount: number;
  currency: string;
}

export interface SendOrderRejectedData extends BaseJobData {
  to: string;
  recipientName: string;
  orderNumber: string;
  orderId: string;
  rejectionReason: string;
}

export interface SendPaymentConfirmationData extends BaseJobData {
  to: string;
  recipientName: string;
  paymentNumber: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
}

export interface SendPasswordChangedData extends BaseJobData {
  to: string;
  recipientName: string;
  userId: string;
  changedAt: string; // ISO-8601
}

export interface SendNotificationEmailData extends BaseJobData {
  to: string;
  recipientName: string;
  subject: string;
  message: string;
  referenceType?: 'order' | 'payment' | 'product' | 'system';
  referenceId?: string;
}

// ── Legacy payloads (Phase-8 — kept until callers are migrated) ───────────────

export interface SendOrderConfirmationData extends BaseJobData {
  to: string;
  recipientName: string;
  orderNumber: string;
  orderId: string;
  totalAmount: number;
  currency: string;
}

export interface SendOrderStatusUpdateData extends BaseJobData {
  to: string;
  recipientName: string;
  orderNumber: string;
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  rejectionReason?: string;
}

export interface SendPaymentReceiptData extends BaseJobData {
  to: string;
  recipientName: string;
  paymentNumber: string;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface SendReminderData extends BaseJobData {
  to: string;
  recipientName: string;
  subject: string;
  body: string;
  referenceType: 'order' | 'payment';
  referenceId: string;
}

export type EmailJobData =
  // ── Phase-9 types ──────────────────────────────────────────────────────────
  | ({ name: 'send-welcome' } & SendWelcomeData)
  | ({ name: 'send-order-request' } & SendOrderRequestData)
  | ({ name: 'send-order-accepted' } & SendOrderAcceptedData)
  | ({ name: 'send-order-rejected' } & SendOrderRejectedData)
  | ({ name: 'send-payment-confirmation' } & SendPaymentConfirmationData)
  | ({ name: 'send-password-changed' } & SendPasswordChangedData)
  | ({ name: 'send-notification' } & SendNotificationEmailData)
  // ── Legacy Phase-8 types ───────────────────────────────────────────────────
  | ({ name: 'send-order-confirmation' } & SendOrderConfirmationData)
  | ({ name: 'send-order-status-update' } & SendOrderStatusUpdateData)
  | ({ name: 'send-payment-receipt' } & SendPaymentReceiptData)
  | ({ name: 'send-reminder' } & SendReminderData);

// ── Notifications queue ───────────────────────────────────────────────────────

export type NotificationJobName =
  | 'create-notification'
  | 'broadcast-system-alert';

export interface CreateNotificationData extends BaseJobData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceEntityType?: 'ORDER' | 'PAYMENT' | 'MESSAGE' | 'PRODUCT';
  referenceEntityId?: string;
  metadata?: Record<string, unknown>;
  /** When true, also push via Socket.io if user is connected. */
  pushViaSocket?: boolean;
}

export interface BroadcastSystemAlertData extends BaseJobData {
  title: string;
  message: string;
  /** Target a specific set of user IDs, or empty for all active users. */
  targetUserIds?: string[];
  metadata?: Record<string, unknown>;
}

export type NotificationJobData =
  | ({ name: 'create-notification' } & CreateNotificationData)
  | ({ name: 'broadcast-system-alert' } & BroadcastSystemAlertData);

// ── Payment queue ─────────────────────────────────────────────────────────────

export type PaymentJobName =
  | 'process-payment'
  | 'refund-payment'
  | 'reconcile-payment';

export interface ProcessPaymentData extends BaseJobData {
  paymentId: string;
  orderId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
}

export interface RefundPaymentData extends BaseJobData {
  paymentId: string;
  orderId: string;
  reason: string;
  requestedByUserId: string;
}

export interface ReconcilePaymentData extends BaseJobData {
  paymentId: string;
  /** Expected status from upstream gateway */
  expectedStatus: PaymentStatus;
  transactionReference?: string;
}

export type PaymentJobData =
  | ({ name: 'process-payment' } & ProcessPaymentData)
  | ({ name: 'refund-payment' } & RefundPaymentData)
  | ({ name: 'reconcile-payment' } & ReconcilePaymentData);

// ── Maintenance queue ─────────────────────────────────────────────────────────

export type MaintenanceJobName =
  | 'expire-stale-orders'
  | 'send-pending-reminders'
  | 'process-pending-notifications'
  | 'reconcile-pending-payments';

export interface ExpireStaleOrdersData extends BaseJobData {
  /** ISO timestamp — orders in PENDING status older than this are expired. */
  olderThanISO: string;
}

export interface SendPendingRemindersData extends BaseJobData {
  /** Target statuses to scan for reminder eligibility. */
  targetStatuses: OrderStatus[];
  /** How many hours past placement to send the first reminder. */
  reminderAfterHours: number;
}

export interface ProcessPendingNotificationsData extends BaseJobData {
  /** Maximum batch size to process per run. */
  batchSize: number;
}

export interface ReconcilePendingPaymentsData extends BaseJobData {
  /** Maximum batch size to process per run. */
  batchSize: number;
}

export type MaintenanceJobData =
  | ({ name: 'expire-stale-orders' } & ExpireStaleOrdersData)
  | ({ name: 'send-pending-reminders' } & SendPendingRemindersData)
  | ({ name: 'process-pending-notifications' } & ProcessPendingNotificationsData)
  | ({ name: 'reconcile-pending-payments' } & ReconcilePendingPaymentsData);

// ── Queue name registry ───────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  PAYMENT: 'payment',
  MAINTENANCE: 'maintenance',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
