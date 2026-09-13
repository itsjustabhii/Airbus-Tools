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
exports.createMaintenanceWorker = createMaintenanceWorker;
const bullmq_1 = require("bullmq");
const shared_1 = require("@airbus-tools/shared");
const logger_1 = require("../../core/logger");
const Notification_1 = require("../../database/models/Notification");
const Order_1 = require("../../database/models/Order");
const Payment_1 = require("../../database/models/Payment");
const queues_1 = require("../queues");
const redis_1 = require("../redis");
const types_1 = require("../types");
// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleExpireStaleOrders(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.MAINTENANCE,
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
    const staleOrders = await Order_1.OrderModel.find({
        status: shared_1.OrderStatus.PENDING,
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
    await Order_1.OrderModel.updateMany({ _id: { $in: ids } }, { $set: { status: shared_1.OrderStatus.REJECTED, rejectionReason: 'Automatically expired due to inactivity', rejectedAt: new Date() } });
    // Notify buyers
    for (const order of staleOrders) {
        await (0, queues_1.enqueueNotification)({
            name: 'create-notification',
            jobId: (0, queues_1.newJobId)(),
            userId: order.buyerId.toString(),
            type: shared_1.NotificationType.ORDER_UPDATE,
            title: 'Order Expired',
            message: `Your order ${order.orderNumber} has been automatically expired due to inactivity.`,
            referenceEntityType: 'ORDER',
            referenceEntityId: order._id.toString(),
            pushViaSocket: true,
        });
        await (0, queues_1.enqueueEmail)({
            name: 'send-order-status-update',
            jobId: (0, queues_1.newJobId)(),
            to: '', // resolving buyer email would require a DB lookup — left for integration
            recipientName: '',
            orderNumber: order.orderNumber,
            orderId: order._id.toString(),
            previousStatus: shared_1.OrderStatus.PENDING,
            newStatus: shared_1.OrderStatus.REJECTED,
            rejectionReason: 'Automatically expired due to inactivity',
        });
    }
    log.info({ expiredCount: staleOrders.length }, 'Stale orders expired');
}
async function handleSendPendingReminders(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.MAINTENANCE,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        targetStatuses: data.targetStatuses,
        reminderAfterHours: data.reminderAfterHours,
    });
    const cutoff = new Date(Date.now() - data.reminderAfterHours * 60 * 60 * 1000);
    const orders = await Order_1.OrderModel.find({
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
        const notifyUserId = order.status === shared_1.OrderStatus.ACCEPTED || order.status === shared_1.OrderStatus.PAYMENT_PENDING
            ? order.buyerId.toString()
            : order.sellerId.toString();
        await (0, queues_1.enqueueNotification)({
            name: 'create-notification',
            jobId: (0, queues_1.newJobId)(),
            userId: notifyUserId,
            type: shared_1.NotificationType.ORDER_UPDATE,
            title: 'Action Required',
            message: `Order ${order.orderNumber} is waiting for your attention (status: ${order.status}).`,
            referenceEntityType: 'ORDER',
            referenceEntityId: order._id.toString(),
            pushViaSocket: true,
        });
        await (0, queues_1.enqueueEmail)({
            name: 'send-reminder',
            jobId: (0, queues_1.newJobId)(),
            to: '', // buyer/seller email lookup left for integration layer
            recipientName: '',
            subject: `Reminder: Order ${order.orderNumber} awaits your action`,
            body: `Your order ${order.orderNumber} is in status ${order.status} and requires attention.`,
            referenceType: 'order',
            referenceId: order._id.toString(),
        });
    }
    log.info({ reminderCount: orders.length }, 'Reminder jobs enqueued');
}
async function handleProcessPendingNotifications(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.MAINTENANCE,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        batchSize: data.batchSize,
    });
    // Find unread notifications older than 1 minute (missed real-time delivery)
    const cutoff = new Date(Date.now() - 60 * 1000);
    const undelivered = await Notification_1.NotificationModel.find({
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
        const { getIO } = await Promise.resolve().then(() => __importStar(require('../../sockets/socketServer')));
        const io = getIO();
        if (io) {
            for (const notif of undelivered) {
                io.to(notif.userId.toString()).emit('notification:new', notif);
            }
            // Mark as pushed
            const ids = undelivered.map((n) => n._id);
            await Notification_1.NotificationModel.updateMany({ _id: { $in: ids } }, { $set: { 'metadata.socketPushed': true } });
            log.info({ pushed: undelivered.length }, 'Pending notifications pushed via Socket.io');
        }
        else {
            log.info('Socket.io not available in this process — skipping push');
        }
    }
    catch (err) {
        log.warn({ err }, 'Failed to push pending notifications (non-fatal)');
    }
}
async function handleReconcilePendingPayments(job, data) {
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.MAINTENANCE,
        jobId: data.jobId,
        bullJobId: job.id,
        name: job.name,
        batchSize: data.batchSize,
    });
    // Find payments stuck in PENDING for more than 15 minutes
    const staleCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const pendingPayments = await Payment_1.PaymentModel.find({
        status: shared_1.PaymentStatus.PENDING,
        createdAt: { $lte: staleCutoff },
    })
        .limit(data.batchSize)
        .select('_id')
        .lean();
    if (pendingPayments.length === 0) {
        log.info('No stale pending payments found');
        return;
    }
    log.info({ count: pendingPayments.length }, `Enqueuing reconciliation for ${pendingPayments.length} stale payments`);
    for (const payment of pendingPayments) {
        await (0, queues_1.enqueuePayment)({
            name: 'reconcile-payment',
            jobId: (0, queues_1.newJobId)(),
            paymentId: payment._id.toString(),
            expectedStatus: shared_1.PaymentStatus.FAILED,
        });
    }
    log.info({ reconcileCount: pendingPayments.length }, 'Reconciliation jobs enqueued');
}
// ── Main processor ────────────────────────────────────────────────────────────
async function processMaintenance(job) {
    const { data } = job;
    const log = logger_1.logger.child({
        queue: types_1.QUEUE_NAMES.MAINTENANCE,
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
            const unknownName = data.name;
            log.error({ unknownJobName: unknownName }, 'Unknown maintenance job name');
            throw new Error(`Unknown maintenance job name: ${unknownName}`);
        }
    }
    log.info('Maintenance job completed');
}
// ── Worker factory ────────────────────────────────────────────────────────────
function createMaintenanceWorker() {
    const worker = new bullmq_1.Worker(types_1.QUEUE_NAMES.MAINTENANCE, processMaintenance, {
        connection: redis_1.bullMQConnection,
        // Maintenance jobs are serial — run one at a time to avoid data races
        concurrency: 1,
    });
    worker.on('completed', (job) => {
        logger_1.logger.info({
            queue: types_1.QUEUE_NAMES.MAINTENANCE,
            jobId: job.data.jobId,
            bullJobId: job.id,
            name: job.name,
        }, '✅ Maintenance job completed');
    });
    worker.on('failed', (job, err) => {
        logger_1.logger.error({
            queue: types_1.QUEUE_NAMES.MAINTENANCE,
            jobId: job?.data?.jobId,
            bullJobId: job?.id,
            name: job?.name,
            attempt: job?.attemptsMade,
            err,
        }, '❌ Maintenance job failed');
    });
    worker.on('error', (err) => {
        logger_1.logger.error({ queue: types_1.QUEUE_NAMES.MAINTENANCE, err }, 'Maintenance worker error');
    });
    logger_1.logger.info({ queue: types_1.QUEUE_NAMES.MAINTENANCE }, '👷 Maintenance worker started');
    return worker;
}
//# sourceMappingURL=maintenanceWorker.js.map