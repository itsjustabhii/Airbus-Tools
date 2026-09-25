"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderService = exports.OrderService = void 0;
const shared_1 = require("@airbus-tools/shared");
const uuid_1 = require("uuid");
const errors_1 = require("../core/errors");
const Order_1 = require("../database/models/Order");
const Product_1 = require("../database/models/Product");
const OrderRepository_1 = require("../database/repositories/OrderRepository");
const queues_1 = require("../jobs/queues");
const orderStateMachine_1 = require("./orderStateMachine");
// ── Helpers ──────────────────────────────────────────────────────────────────
function generateOrderNumber() {
    const year = new Date().getFullYear();
    // Take the first 8 hex chars of a UUID v4 for a short, collision-resistant suffix
    const uid = (0, uuid_1.v4)().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `ORD-${year}-${uid}`;
}
/** Map each target status to the timestamp field that should be set */
const STATUS_TIMESTAMP_FIELDS = {
    [shared_1.OrderStatus.ACCEPTED]: 'acceptedAt',
    [shared_1.OrderStatus.REJECTED]: 'rejectedAt',
    [shared_1.OrderStatus.PAID]: 'paidAt',
    [shared_1.OrderStatus.COMPLETED]: 'completedAt',
};
// ── Service ──────────────────────────────────────────────────────────────────
class OrderService {
    /**
     * Airlines submit a new order request.
     *
     * Price snapshot:
     *   Each item's unitPrice and currency are copied from the Product document
     *   at the moment the order is created. This snapshot is immutable — future
     *   product price changes do NOT affect existing orders.
     */
    async createOrder(input) {
        const { buyerId, items: itemInputs, shippingAddress, notes } = input;
        if (!itemInputs.length) {
            throw new errors_1.ForbiddenError('Order must contain at least one item');
        }
        // Fetch all products in one query
        const productIds = itemInputs.map((i) => i.productId);
        const products = await Product_1.ProductModel.find({ _id: { $in: productIds } }).exec();
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));
        // Validate all products exist and belong to the same supplier
        const sellerIds = new Set();
        for (const item of itemInputs) {
            const product = productMap.get(item.productId);
            if (!product) {
                throw new errors_1.NotFoundError(`Product ${item.productId} not found`);
            }
            sellerIds.add(product.sellerId.toString());
        }
        if (sellerIds.size > 1) {
            throw new errors_1.ForbiddenError('All items in a single order must belong to the same supplier');
        }
        const sellerId = [...sellerIds][0];
        // Build price-snapshotted items
        const now = new Date();
        const orderItems = itemInputs.map((item) => {
            const product = productMap.get(item.productId);
            const unitPrice = product.price;
            const currency = product.currency;
            return {
                productId: item.productId,
                partNumber: product.partNumber,
                title: product.title,
                unitPrice,
                quantity: item.quantity,
                totalPrice: unitPrice * item.quantity,
                currency,
            };
        });
        const subtotal = orderItems.reduce((s, i) => s + i.totalPrice, 0);
        const tax = 0;
        const shippingFee = 0;
        const totalAmount = subtotal + tax + shippingFee;
        const order = await Order_1.OrderModel.create({
            orderNumber: generateOrderNumber(),
            buyerId,
            sellerId,
            status: shared_1.OrderStatus.PENDING,
            items: orderItems,
            subtotal,
            tax,
            shippingFee,
            totalAmount,
            currency: orderItems[0]?.currency ?? 'USD',
            shippingAddress,
            ...(notes !== undefined ? { notes } : {}),
            placedAt: now,
        });
        // ── Async side-effects (NOT in the HTTP request lifecycle) ────────────────
        // Enqueue email and notification jobs — they run in the worker process.
        void Promise.allSettled([
            (0, queues_1.enqueueEmail)({
                name: 'send-order-request',
                jobId: (0, queues_1.newJobId)(),
                to: '', // buyer email resolved in worker via DB lookup
                recipientName: '',
                orderNumber: order.orderNumber,
                orderId: order._id.toString(),
                totalAmount: order.totalAmount,
                currency: order.currency,
                supplierTo: '', // supplier email resolved in worker via DB lookup
                supplierName: '',
            }),
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: buyerId,
                type: shared_1.NotificationType.ORDER_UPDATE,
                title: 'Order Submitted',
                message: `Your order ${order.orderNumber} has been submitted and is awaiting supplier review.`,
                referenceEntityType: 'ORDER',
                referenceEntityId: order._id.toString(),
                pushViaSocket: true,
            }),
            // Notify seller of new incoming order
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: sellerId ?? '',
                type: shared_1.NotificationType.ORDER_UPDATE,
                title: 'New Order Received',
                message: `You have received a new order ${order.orderNumber}. Please review and accept or reject it.`,
                referenceEntityType: 'ORDER',
                referenceEntityId: order._id.toString(),
                pushViaSocket: true,
            }),
        ]);
        return order;
    }
    /**
     * Advance an order through the state machine.
     *
     * Ownership rules:
     * - Only the buying AIRLINE or an ADMIN may view/act on buyer-side transitions.
     * - Only the selling SUPPLIER or an ADMIN may view/act on supplier-side transitions.
     * - Neither party may modify orders they are not a participant in.
     * - Completed/rejected orders are immutable.
     */
    async transitionOrder(input) {
        const { orderId, nextStatus, callerId, callerRole, rejectionReason } = input;
        const order = await OrderRepository_1.orderRepository.findById(orderId);
        if (!order) {
            throw new errors_1.NotFoundError('Order not found');
        }
        // Access control — only participants can touch an order
        this.assertParticipant(order, callerId, callerRole);
        // Terminal guard
        if ((0, orderStateMachine_1.isTerminal)(order.status)) {
            throw new errors_1.ForbiddenError(`Order ${order.orderNumber} is in a terminal state (${order.status}) and cannot be modified`);
        }
        // State machine guard (also checks role permission for the transition)
        (0, orderStateMachine_1.assertTransition)(order.status, nextStatus, callerRole);
        // Validate business-level preconditions
        if (nextStatus === shared_1.OrderStatus.REJECTED && !rejectionReason?.trim()) {
            throw new errors_1.ForbiddenError('A rejection reason is required when rejecting an order');
        }
        // Build update
        const update = { status: nextStatus };
        const tsField = STATUS_TIMESTAMP_FIELDS[nextStatus];
        if (tsField) {
            update[tsField] = new Date();
        }
        if (nextStatus === shared_1.OrderStatus.REJECTED) {
            update['rejectionReason'] = rejectionReason;
        }
        const updated = await OrderRepository_1.orderRepository.updateById(orderId, update);
        if (!updated) {
            throw new errors_1.NotFoundError('Order not found');
        }
        // ── Async side-effects (NOT in the HTTP request lifecycle) ────────────────
        void Promise.allSettled([
            (0, queues_1.enqueueEmail)(nextStatus === 'REJECTED'
                ? {
                    name: 'send-order-rejected',
                    jobId: (0, queues_1.newJobId)(),
                    to: '', // buyer email resolved in worker via DB lookup
                    recipientName: '',
                    orderNumber: order.orderNumber,
                    orderId: orderId,
                    rejectionReason: rejectionReason ?? 'No reason provided',
                }
                : {
                    name: 'send-order-accepted',
                    jobId: (0, queues_1.newJobId)(),
                    to: '', // buyer email resolved in worker via DB lookup
                    recipientName: '',
                    orderNumber: order.orderNumber,
                    orderId: orderId,
                    totalAmount: order.totalAmount,
                    currency: order.currency,
                }),
            // Notify buyer and seller of the status change with specific titles
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: order.buyerId.toString(),
                type: shared_1.NotificationType.ORDER_UPDATE,
                title: nextStatus === shared_1.OrderStatus.ACCEPTED
                    ? 'Order Accepted'
                    : nextStatus === shared_1.OrderStatus.REJECTED
                        ? 'Order Rejected'
                        : `Order ${order.orderNumber} Updated`,
                message: nextStatus === shared_1.OrderStatus.ACCEPTED
                    ? `Your order ${order.orderNumber} was accepted by the supplier.`
                    : nextStatus === shared_1.OrderStatus.REJECTED
                        ? `Your order ${order.orderNumber} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`
                        : `Your order status changed to ${nextStatus}.`,
                referenceEntityType: 'ORDER',
                referenceEntityId: orderId,
                pushViaSocket: true,
            }),
            (0, queues_1.enqueueNotification)({
                name: 'create-notification',
                jobId: (0, queues_1.newJobId)(),
                userId: order.sellerId.toString(),
                type: shared_1.NotificationType.ORDER_UPDATE,
                title: nextStatus === shared_1.OrderStatus.ACCEPTED
                    ? 'Order Accepted'
                    : nextStatus === shared_1.OrderStatus.REJECTED
                        ? 'Order Rejected'
                        : `Order ${order.orderNumber} Updated`,
                message: nextStatus === shared_1.OrderStatus.ACCEPTED
                    ? `You accepted order ${order.orderNumber}.`
                    : nextStatus === shared_1.OrderStatus.REJECTED
                        ? `You rejected order ${order.orderNumber}.`
                        : `Order ${order.orderNumber} status changed to ${nextStatus}.`,
                referenceEntityType: 'ORDER',
                referenceEntityId: orderId,
                pushViaSocket: true,
            }),
        ]);
        return updated;
    }
    /** Retrieve a single order, enforcing that the caller is a participant. */
    async getOrder(orderId, callerId, callerRole) {
        const order = await OrderRepository_1.orderRepository.findById(orderId);
        if (!order) {
            throw new errors_1.NotFoundError('Order not found');
        }
        this.assertParticipant(order, callerId, callerRole);
        return order;
    }
    /** List orders scoped to the caller (airline sees their purchases, supplier sees their sales). */
    async listOrders(callerId, callerRole, filter, options) {
        let scopedFilter;
        if (callerRole === shared_1.UserRole.ADMIN) {
            scopedFilter = { ...filter };
        }
        else if (callerRole === shared_1.UserRole.AIRLINE) {
            scopedFilter = { ...filter, buyerId: callerId };
        }
        else if (callerRole === shared_1.UserRole.SUPPLIER) {
            scopedFilter = { ...filter, sellerId: callerId };
        }
        else {
            throw new errors_1.ForbiddenError('Only airlines, suppliers and admins can access orders');
        }
        return OrderRepository_1.orderRepository.filterOrders(scopedFilter, options);
    }
    // ── Private helpers ────────────────────────────────────────────────────────
    assertParticipant(order, callerId, callerRole) {
        if (callerRole === shared_1.UserRole.ADMIN)
            return;
        const isBuyer = order.buyerId.toString() === callerId;
        const isSeller = order.sellerId.toString() === callerId;
        if (!isBuyer && !isSeller) {
            throw new errors_1.NotFoundError('Order not found');
        }
    }
}
exports.OrderService = OrderService;
exports.orderService = new OrderService();
//# sourceMappingURL=orderService.js.map