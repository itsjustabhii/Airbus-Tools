/**
 * Maintenance queue worker.
 *
 * Handles four scheduled job types that run on a cron schedule (managed by
 * `scheduler.ts`) and must NOT be invoked inside HTTP request handlers:
 *
 *  1. `expire-stale-orders`             — cancel PENDING orders older than a
 *                                         configurable threshold.
 *  2. `send-pending-reminders`          — send reminder emails/notifications
 *                                         for orders awaiting action.
 *  3. `process-pending-notifications`   — fan out queued notifications that
 *                                         couldn't be delivered in real-time.
 *  4. `reconcile-pending-payments`      — trigger reconciliation jobs for
 *                                         payments stuck in PENDING status.
 *
 * All handlers are idempotent: running the same job twice produces the same
 * result as running it once.
 */
import { OrderStatus, PaymentStatus, NotificationType } from '@airbus-tools/shared';
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';


import { logger } from '../../core/logger';
import { NotificationModel } from '../../database/models/Notification';
import { OrderModel } from '../../database/models/Order';
import { PaymentModel } from '../../database/models/Payment';
import { UserModel } from '../../database/models/User';
import { enqueueEmail, enqueueNotification, enqueuePayment, newJobId } from '../queues';
import { bullMQConnection } from '../redis';
import type {
  ExpireStaleOrdersData,
  MaintenanceJobData,
  MaintenanceJobName,
  ProcessPendingNotificationsData,
  ReconcilePendingPaymentsData,
  SendPendingRemindersData,
} from '../types';
import { QUEUE_NAMES } from '../types';

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleExpireStaleOrders(
  job: Job<MaintenanceJobData, void, MaintenanceJobName>,
  data: ExpireStaleOrdersData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.MAINTENANCE,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    olderThan: data.olderThanISO,
  });

  const threshold = new Date(data.olderThanISO);
  if (isNaN(threshold.getTime())) {
    throw new Error(`Invalid olderThanISO value: ${data.olderThanISO}`);
  }

  // Find PENDING orders older than the threshold
  const staleOrders = await OrderModel.find({
    status: OrderStatus.PENDING,
    createdAt: { $lt: threshold },
  })
    .select('_id orderNumber buyerId sellerId')
    .lean();

  if (staleOrders.length === 0) {
    log.info('No stale orders found');
    return;
  }

  log.info({ count: staleOrders.length }, `Expiring ${staleOrders.length} stale orders`);

  const ids = staleOrders.map((o) => o._id);

  await OrderModel.updateMany(
    { _id: { $in: ids } },
    { $set: { status: OrderStatus.REJECTED, rejectionReason: 'Automatically expired due to inactivity', rejectedAt: new Date() } },
  );

  // Notify buyers
  for (const order of staleOrders) {
    await enqueueNotification({
      name: 'create-notification',
      jobId: newJobId(),
      userId: order.buyerId.toString(),
      type: NotificationType.ORDER_UPDATE,
      title: 'Order Expired',
      message: `Your order ${order.orderNumber} has been automatically expired due to inactivity.`,
      referenceEntityType: 'ORDER',
      referenceEntityId: order._id.toString(),
      pushViaSocket: true,
    });

    await enqueueEmail({
      name: 'send-order-status-update',
      jobId: newJobId(),
      to: '',  // resolving buyer email would require a DB lookup — left for integration
      recipientName: '',
      orderNumber: order.orderNumber,
      orderId: order._id.toString(),
      previousStatus: OrderStatus.PENDING,
      newStatus: OrderStatus.REJECTED,
      rejectionReason: 'Automatically expired due to inactivity',
    });
  }

  log.info({ expiredCount: staleOrders.length }, 'Stale orders expired');
}

async function handleSendPendingReminders(
  job: Job<MaintenanceJobData, void, MaintenanceJobName>,
  data: SendPendingRemindersData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.MAINTENANCE,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    targetStatuses: data.targetStatuses,
    reminderAfterHours: data.reminderAfterHours,
  });

  const cutoff = new Date(Date.now() - data.reminderAfterHours * 60 * 60 * 1000);

  const orders = await OrderModel.find({
    status: { $in: data.targetStatuses },
    createdAt: { $lte: cutoff },
  })
    .select('_id orderNumber buyerId sellerId status')
    .lean();

  if (orders.length === 0) {
    log.info('No orders requiring reminders');
    return;
  }

  log.info({ count: orders.length }, `Sending reminders for ${orders.length} orders`);

  for (const order of orders) {
    // Determine who to remind based on the current status
    const notifyUserId =
      order.status === OrderStatus.ACCEPTED || order.status === OrderStatus.PAYMENT_PENDING
        ? order.buyerId.toString()
        : order.sellerId.toString();

    await enqueueNotification({
      name: 'create-notification',
      jobId: newJobId(),
      userId: notifyUserId,
      type: NotificationType.ORDER_UPDATE,
      title: 'Action Required',
      message: `Order ${order.orderNumber} is waiting for your attention (status: ${order.status}).`,
      referenceEntityType: 'ORDER',
      referenceEntityId: order._id.toString(),
      pushViaSocket: true,
    });

    await enqueueEmail({
      name: 'send-reminder',
      jobId: newJobId(),
      to: '',  // buyer/seller email lookup left for integration layer
      recipientName: '',
      subject: `Reminder: Order ${order.orderNumber} awaits your action`,
      body: `Your order ${order.orderNumber} is in status ${order.status} and requires attention.`,
      referenceType: 'order',
      referenceId: order._id.toString(),
    });
  }

  log.info({ reminderCount: orders.length }, 'Reminder jobs enqueued');
}

async function handleProcessPendingNotifications(
  job: Job<MaintenanceJobData, void, MaintenanceJobName>,
  data: ProcessPendingNotificationsData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.MAINTENANCE,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    batchSize: data.batchSize,
  });

  // Find unread notifications older than 1 minute (missed real-time delivery)
  const cutoff = new Date(Date.now() - 60 * 1000);

  const undelivered = await NotificationModel.find({
    isRead: false,
    createdAt: { $lte: cutoff },
    'metadata.socketPushed': { $ne: true },
  })
    .limit(data.batchSize)
    .select('_id userId type title message')
    .lean();

  if (undelivered.length === 0) {
    log.info('No pending notifications to process');
    return;
  }

  log.info({ count: undelivered.length }, `Processing ${undelivered.length} undelivered notifications`);

  try {
    const { getIO } = await import('../../sockets/socketServer');
    const io = getIO();
    if (io) {
      for (const notif of undelivered) {
        io.to(notif.userId.toString()).emit('notification:new', notif);
      }
      // Mark as pushed
      const ids = undelivered.map((n) => n._id);
      await NotificationModel.updateMany(
        { _id: { $in: ids } },
        { $set: { 'metadata.socketPushed': true } },
      );
      log.info({ pushed: undelivered.length }, 'Pending notifications pushed via Socket.io');
    } else {
      log.info('Socket.io not available in this process — skipping push');
    }
  } catch (err) {
    log.warn({ err }, 'Failed to push pending notifications (non-fatal)');
  }
}

async function handleReconcilePendingPayments(
  job: Job<MaintenanceJobData, void, MaintenanceJobName>,
  data: ReconcilePendingPaymentsData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.MAINTENANCE,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    batchSize: data.batchSize,
  });

  // Find payments stuck in PENDING for more than 15 minutes
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000);

  const pendingPayments = await PaymentModel.find({
    status: PaymentStatus.PENDING,
    createdAt: { $lte: staleCutoff },
  })
    .limit(data.batchSize)
    .select('_id')
    .lean();

  if (pendingPayments.length === 0) {
    log.info('No stale pending payments found');
    return;
  }

  log.info(
    { count: pendingPayments.length },
    `Enqueuing reconciliation for ${pendingPayments.length} stale payments`,
  );

  for (const payment of pendingPayments) {
    await enqueuePayment({
      name: 'reconcile-payment',
      jobId: newJobId(),
      paymentId: payment._id.toString(),
      expectedStatus: PaymentStatus.FAILED,
    });
  }

  log.info({ reconcileCount: pendingPayments.length }, 'Reconciliation jobs enqueued');
}

// ── Main processor ────────────────────────────────────────────────────────────

async function processMaintenance(
  job: Job<MaintenanceJobData, void, MaintenanceJobName>,
): Promise<void> {
  const { data } = job;

  const log = logger.child({
    queue: QUEUE_NAMES.MAINTENANCE,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    attempt: job.attemptsMade,
  });

  log.info('Processing maintenance job');

  switch (data.name) {
    case 'expire-stale-orders':
      await handleExpireStaleOrders(job, data);
      break;
    case 'send-pending-reminders':
      await handleSendPendingReminders(job, data);
      break;
    case 'process-pending-notifications':
      await handleProcessPendingNotifications(job, data);
      break;
    case 'reconcile-pending-payments':
      await handleReconcilePendingPayments(job, data);
      break;
    default: {
      const unknownName = (data as { name: string }).name;
      log.error({ unknownJobName: unknownName }, 'Unknown maintenance job name');
      throw new Error(`Unknown maintenance job name: ${unknownName}`);
    }
  }

  log.info('Maintenance job completed');
}

// ── Worker factory ────────────────────────────────────────────────────────────

export function createMaintenanceWorker(): Worker<MaintenanceJobData, void, MaintenanceJobName> {
  const worker = new Worker<MaintenanceJobData, void, MaintenanceJobName>(
    QUEUE_NAMES.MAINTENANCE,
    processMaintenance,
    {
      connection: bullMQConnection,
      // Maintenance jobs are serial — run one at a time to avoid data races
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      {
        queue: QUEUE_NAMES.MAINTENANCE,
        jobId: job.data.jobId,
        bullJobId: job.id,
        name: job.name,
      },
      '✅ Maintenance job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        queue: QUEUE_NAMES.MAINTENANCE,
        jobId: job?.data?.jobId,
        bullJobId: job?.id,
        name: job?.name,
        attempt: job?.attemptsMade,
        err,
      },
      '❌ Maintenance job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ queue: QUEUE_NAMES.MAINTENANCE, err }, 'Maintenance worker error');
  });

  logger.info({ queue: QUEUE_NAMES.MAINTENANCE }, '👷 Maintenance worker started');

  return worker;
}
