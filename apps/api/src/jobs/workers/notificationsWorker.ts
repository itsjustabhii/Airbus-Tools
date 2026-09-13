/**
 * Notifications queue worker.
 *
 * Responsibilities:
 * 1. `create-notification` — persist a Notification document in MongoDB.
 *    When `pushViaSocket` is true the handler also emits a real-time event
 *    via Socket.io (if the Socket.io server is running in this process).
 * 2. `broadcast-system-alert` — create Notification documents for a list of
 *    users (or all active users) and push real-time alerts.
 *
 * Idempotency: the job's `jobId` is stored in `notification.metadata.jobId`.
 * Before persisting, we query for an existing notification with that jobId to
 * avoid duplicates on retries.
 */
import type { Job } from 'bullmq';
import { Worker } from 'bullmq';

import { NotificationType } from '@airbus-tools/shared';

import { logger } from '../../core/logger';
import { NotificationModel } from '../../database/models/Notification';
import { UserModel } from '../../database/models/User';
import { notificationService } from '../../services/notificationService';
import { bullMQConnection } from '../redis';
import type {
  BroadcastSystemAlertData,
  CreateNotificationData,
  NotificationJobData,
  NotificationJobName,
} from '../types';
import { QUEUE_NAMES } from '../types';

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleCreateNotification(
  job: Job<NotificationJobData, void, NotificationJobName>,
  data: CreateNotificationData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.NOTIFICATIONS,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    userId: data.userId,
    type: data.type,
  });

  // Idempotency check: skip if already persisted
  const existing = await NotificationModel.findOne({
    'metadata.jobId': data.jobId,
  }).lean();

  if (existing) {
    log.warn('Notification already persisted — skipping duplicate (idempotent)');
    return;
  }

  const notification = await NotificationModel.create({
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    isRead: false,
    ...(data.referenceEntityType !== undefined ? { referenceEntityType: data.referenceEntityType } : {}),
    ...(data.referenceEntityId   !== undefined ? { referenceEntityId:   data.referenceEntityId   } : {}),
    metadata: {
      ...(data.metadata ?? {}),
      jobId: data.jobId,
    },
  });

  log.info({ notificationId: notification._id?.toString() }, 'Notification persisted');

  // Invalidate ephemeral unread count cache in Redis
  try {
    await notificationService.invalidateUnreadCountCache(data.userId);
  } catch (err) {
    log.warn({ err }, 'Failed to invalidate unread count cache');
  }

  if (data.pushViaSocket) {
    // Dynamic import avoids a circular dependency between the worker and the
    // Socket.io server. The socket server module exports `getIO()` which
    // returns null if Socket.io is not running (e.g. in the worker process).
    try {
      const { getIO } = await import('../../sockets/socketServer');
      const io = getIO();
      if (io) {
        io.to(`user:${data.userId}`).emit('notification:new', notification.toJSON());
        log.info({ userId: data.userId }, 'Real-time notification pushed via Socket.io');
      }
    } catch (err) {
      // Non-fatal — the notification was persisted; the user will see it on
      // their next poll.
      log.warn({ err }, 'Failed to push Socket.io notification (non-fatal)');
    }
  }
}

async function handleBroadcastSystemAlert(
  job: Job<NotificationJobData, void, NotificationJobName>,
  data: BroadcastSystemAlertData,
): Promise<void> {
  const log = logger.child({
    queue: QUEUE_NAMES.NOTIFICATIONS,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    targetCount: data.targetUserIds?.length ?? 'all',
  });

  // Idempotency: if any notification for this broadcast already exists, skip
  const alreadyBroadcast = await NotificationModel.findOne({
    'metadata.broadcastJobId': data.jobId,
  }).lean();

  if (alreadyBroadcast) {
    log.warn('Broadcast already executed — skipping (idempotent)');
    return;
  }

  let userIds: string[] = data.targetUserIds ?? [];

  if (userIds.length === 0) {
    // Target all active users
    const users = await UserModel.find({ status: 'ACTIVE' }).select('_id').lean();
    userIds = users.map((u) => u._id.toString());
  }

  if (userIds.length === 0) {
    log.warn('No target users found for broadcast — nothing to do');
    return;
  }

  const docs = userIds.map((userId) => ({
    userId,
    type: NotificationType.SYSTEM_ALERT,
    title: data.title,
    message: data.message,
    isRead: false,
    metadata: {
      ...(data.metadata ?? {}),
      broadcastJobId: data.jobId,
    },
  }));

  await NotificationModel.insertMany(docs, { ordered: false });

  log.info({ count: docs.length }, `System alert broadcast to ${docs.length} users`);

  // Invalidate unread counts for all targeted users
  await Promise.allSettled(
    userIds.map((uid) => notificationService.invalidateUnreadCountCache(uid)),
  );

  // Push via Socket.io to all connected users
  try {
    const { getIO } = await import('../../sockets/socketServer');
    const io = getIO();
    if (io) {
      for (const userId of userIds) {
        io.to(userId).emit('notification:system-alert', {
          title: data.title,
          message: data.message,
        });
      }
      log.info('Real-time system alert pushed via Socket.io');
    }
  } catch (err) {
    log.warn({ err }, 'Failed to push Socket.io system alert (non-fatal)');
  }
}

// ── Main processor ────────────────────────────────────────────────────────────

async function processNotification(
  job: Job<NotificationJobData, void, NotificationJobName>,
): Promise<void> {
  const { data } = job;

  const log = logger.child({
    queue: QUEUE_NAMES.NOTIFICATIONS,
    jobId: data.jobId,
    bullJobId: job.id,
    name: job.name,
    attempt: job.attemptsMade,
  });

  log.info('Processing notification job');

  switch (data.name) {
    case 'create-notification':
      await handleCreateNotification(job, data);
      break;
    case 'broadcast-system-alert':
      await handleBroadcastSystemAlert(job, data);
      break;
    default: {
      const unknownName = (data as { name: string }).name;
      log.error({ unknownJobName: unknownName }, 'Unknown notification job name');
      throw new Error(`Unknown notification job name: ${unknownName}`);
    }
  }

  log.info('Notification job completed');
}

// ── Worker factory ────────────────────────────────────────────────────────────

export function createNotificationsWorker(): Worker<NotificationJobData, void, NotificationJobName> {
  const worker = new Worker<NotificationJobData, void, NotificationJobName>(
    QUEUE_NAMES.NOTIFICATIONS,
    processNotification,
    {
      connection: bullMQConnection,
      concurrency: 10,
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      {
        queue: QUEUE_NAMES.NOTIFICATIONS,
        jobId: job.data.jobId,
        bullJobId: job.id,
        name: job.name,
      },
      '✅ Notification job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      {
        queue: QUEUE_NAMES.NOTIFICATIONS,
        jobId: job?.data?.jobId,
        bullJobId: job?.id,
        name: job?.name,
        attempt: job?.attemptsMade,
        err,
      },
      '❌ Notification job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ queue: QUEUE_NAMES.NOTIFICATIONS, err }, 'Notifications worker error');
  });

  logger.info({ queue: QUEUE_NAMES.NOTIFICATIONS }, '👷 Notifications worker started');

  return worker;
}
