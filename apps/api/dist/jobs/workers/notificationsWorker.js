"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotificationsWorker = createNotificationsWorker;
const bullmq_1 = require("bullmq");
const shared_1 = require("@airbus-tools/shared");
const logger_1 = require("../../core/logger");
const Notification_1 = require("../../database/models/Notification");
const User_1 = require("../../database/models/User");
const notificationService_1 = require("../../services/notificationService");
const redis_1 = require("../redis");
const types_1 = require("../types");
// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleCreateNotification(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.NOTIFICATIONS,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        userId: data.userId,
        type: data.type,
    });
    // Idempotency check: skip if already persisted
    const existing = await Notification_1.NotificationModel.findOne({
        'metadata.jobId': data.jobId,
    }).lean();
    if (existing) {
        log.warn('Notification already persisted — skipping duplicate (idempotent)');
        return;
    }
    const notification = await Notification_1.NotificationModel.create({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        isRead: false,
        ...(data.referenceEntityType !== undefined ? { referenceEntityType: data.referenceEntityType } : {}),
        ...(data.referenceEntityId !== undefined ? { referenceEntityId: data.referenceEntityId } : {}),
        metadata: {
            ...(data.metadata ?? {}),
            jobId: data.jobId,
        },
    });
    log.info({ notificationId: notification._id?.toString() }, 'Notification persisted');
    // Invalidate ephemeral unread count cache in Redis
    try {
        await notificationService_1.notificationService.invalidateUnreadCountCache(data.userId);
    }
    catch (err) {
        log.warn({ err }, 'Failed to invalidate unread count cache');
    }
    if (data.pushViaSocket) {
        // Dynamic import avoids a circular dependency between the worker and the
        // Socket.io server. The socket server module exports `getIO()` which
        // returns null if Socket.io is not running (e.g. in the worker process).
        try {
            const { getIO } = await Promise.resolve().then(() => __importStar(require('../../sockets/socketServer')));
            const io = getIO();
            if (io) {
                io.to(`user:${data.userId}`).emit('notification:new', notification.toJSON());
                log.info({ userId: data.userId }, 'Real-time notification pushed via Socket.io');
            }
        }
        catch (err) {
            // Non-fatal — the notification was persisted; the user will see it on
            // their next poll.
            log.warn({ err }, 'Failed to push Socket.io notification (non-fatal)');
        }
    }
}
async function handleBroadcastSystemAlert(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.NOTIFICATIONS,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        targetCount: data.targetUserIds?.length ?? 'all',
    });
    // Idempotency: if any notification for this broadcast already exists, skip
    const alreadyBroadcast = await Notification_1.NotificationModel.findOne({
        'metadata.broadcastJobId': data.jobId,
    }).lean();
    if (alreadyBroadcast) {
        log.warn('Broadcast already executed — skipping (idempotent)');
        return;
    }
    let userIds = data.targetUserIds ?? [];
    if (userIds.length === 0) {
        // Target all active users
        const users = await User_1.UserModel.find({ status: 'ACTIVE' }).select('_id').lean();
        userIds = users.map((u) => u._id.toString());
    }
    if (userIds.length === 0) {
        log.warn('No target users found for broadcast — nothing to do');
        return;
    }
    const docs = userIds.map((userId) => ({
        userId,
        type: shared_1.NotificationType.SYSTEM_ALERT,
        title: data.title,
        message: data.message,
        isRead: false,
        metadata: {
            ...(data.metadata ?? {}),
            broadcastJobId: data.jobId,
        },
    }));
    await Notification_1.NotificationModel.insertMany(docs, { ordered: false });
    log.info({ count: docs.length }, `System alert broadcast to ${docs.length} users`);
    // Invalidate unread counts for all targeted users
    await Promise.allSettled(userIds.map((uid) => notificationService_1.notificationService.invalidateUnreadCountCache(uid)));
    // Push via Socket.io to all connected users
    try {
        const { getIO } = await Promise.resolve().then(() => __importStar(require('../../sockets/socketServer')));
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
    }
    catch (err) {
        log.warn({ err }, 'Failed to push Socket.io system alert (non-fatal)');
    }
}
// ── Main processor ────────────────────────────────────────────────────────────
async function processNotification(job) {
    const { data } = job;
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.NOTIFICATIONS,
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
            const unknownName = data.name;
            log.error({ unknownJobName: unknownName }, 'Unknown notification job name');
            throw new Error(`Unknown notification job name: ${unknownName}`);
        }
    }
    log.info('Notification job completed');
}
// ── Worker factory ────────────────────────────────────────────────────────────
function createNotificationsWorker() {
    const worker = new bullmq_1.Worker(types_1.QUEUE_NAMES.NOTIFICATIONS, processNotification, {
        connection: redis_1.bullMQConnection,
        concurrency: 10,
    });
    worker.on('completed', (job) => {
        logger_1.logger.info({
            queue: types_1.QUEUE_NAMES.NOTIFICATIONS,
            jobId: job.data.jobId,
            bullJobId: job.id,
            name: job.name,
        }, '✅ Notification job completed');
    });
    worker.on('failed', (job, err) => {
        logger_1.logger.error({
            queue: types_1.QUEUE_NAMES.NOTIFICATIONS,
            jobId: job?.data?.jobId,
            bullJobId: job?.id,
            name: job?.name,
            attempt: job?.attemptsMade,
            err,
        }, '❌ Notification job failed');
    });
    worker.on('error', (err) => {
        logger_1.logger.error({ queue: types_1.QUEUE_NAMES.NOTIFICATIONS, err }, 'Notifications worker error');
    });
    logger_1.logger.info({ queue: types_1.QUEUE_NAMES.NOTIFICATIONS }, '👷 Notifications worker started');
    return worker;
}
//# sourceMappingURL=notificationsWorker.js.map