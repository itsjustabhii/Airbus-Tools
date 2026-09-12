import { v4 as uuidv4 } from 'uuid';

import { NotificationType, OrderStatus, UserRole, type OrderItem } from '@airbus-tools/shared';

import { ForbiddenError, NotFoundError } from '../core/errors';
import { OrderModel, type IOrderDocument } from '../database/models/Order';
import { ProductModel } from '../database/models/Product';
import { orderRepository, type OrderFilter } from '../database/repositories/OrderRepository';
import type { PaginatedResult, PaginationOptions } from '../database/repositories/BaseRepository';
import { enqueueEmail, enqueueNotification, newJobId } from '../jobs/queues';

import { assertTransition, isTerminal } from './orderStateMachine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  buyerId: string;
  items: CreateOrderItemInput[];
  shippingAddress: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  notes?: string;
}

export interface TransitionOrderInput {
  orderId: string;
  nextStatus: OrderStatus;
  callerId: string;
  callerRole: UserRole;
  /** Required when transitioning to REJECTED */
  rejectionReason?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  // Take the first 8 hex chars of a UUID v4 for a short, collision-resistant suffix
  const uid = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ORD-${year}-${uid}`;
}

/** Map each target status to the timestamp field that should be set */
const STATUS_TIMESTAMP_FIELDS: Partial<Record<OrderStatus, keyof IOrderDocument>> = {
  [OrderStatus.ACCEPTED]:        'acceptedAt',
  [OrderStatus.REJECTED]:        'rejectedAt',
  [OrderStatus.PAID]:            'paidAt',
  [OrderStatus.COMPLETED]:       'completedAt',
};

// ── Service ──────────────────────────────────────────────────────────────────

export class OrderService {
  /**
   * Airlines submit a new order request.
   *
   * Price snapshot:
   *   Each item's unitPrice and currency are copied from the Product document
   *   at the moment the order is created. This snapshot is immutable — future
   *   product price changes do NOT affect existing orders.
   */
  async createOrder(input: CreateOrderInput): Promise<IOrderDocument> {
    const { buyerId, items: itemInputs, shippingAddress, notes } = input;

    if (!itemInputs.length) {
      throw new ForbiddenError('Order must contain at least one item');
    }

    // Fetch all products in one query
    const productIds = itemInputs.map((i) => i.productId);
    const products = await ProductModel.find({ _id: { $in: productIds } }).exec();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    // Validate all products exist and belong to the same supplier
    const sellerIds = new Set<string>();
    for (const item of itemInputs) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundError(`Product ${item.productId} not found`);
      }
      sellerIds.add(product.sellerId.toString());
    }

    if (sellerIds.size > 1) {
      throw new ForbiddenError('All items in a single order must belong to the same supplier');
    }

    const sellerId = [...sellerIds][0]!;

    // Build price-snapshotted items
    const now = new Date();
    const orderItems: OrderItem[] = itemInputs.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = product.price;
      const currency  = product.currency;
      return {
        productId: item.productId,
        partNumber: product.partNumber,
        title:      product.title,
        unitPrice,
        quantity:   item.quantity,
        totalPrice: unitPrice * item.quantity,
        currency,
      };
    });

    const subtotal   = orderItems.reduce((s, i) => s + i.totalPrice, 0);
    const tax        = 0;
    const shippingFee = 0;
    const totalAmount = subtotal + tax + shippingFee;

    const order = await OrderModel.create({
      orderNumber: generateOrderNumber(),
      buyerId,
      sellerId,
      status: OrderStatus.PENDING,
      items: orderItems,
      subtotal,
      tax,
      shippingFee,
      totalAmount,
      currency: orderItems[0]!.currency,
      shippingAddress,
      ...(notes !== undefined ? { notes } : {}),
      placedAt: now,
    });

    // ── Async side-effects (NOT in the HTTP request lifecycle) ────────────────
    // Enqueue email and notification jobs — they run in the worker process.
    void Promise.allSettled([
      enqueueEmail({
        name: 'send-order-confirmation',
        jobId: newJobId(),
        to: '',          // buyer email resolved in worker via DB lookup
        recipientName: '',
        orderNumber: order.orderNumber,
        orderId: order._id.toString(),
        totalAmount: order.totalAmount,
        currency: order.currency,
      }),
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: buyerId,
        type: NotificationType.ORDER_UPDATE,
        title: 'Order Submitted',
        message: `Your order ${order.orderNumber} has been submitted and is awaiting supplier review.`,
        referenceEntityType: 'ORDER',
        referenceEntityId: order._id.toString(),
        pushViaSocket: true,
      }),
      // Notify seller of new incoming order
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: sellerId,
        type: NotificationType.ORDER_UPDATE,
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
  async transitionOrder(input: TransitionOrderInput): Promise<IOrderDocument> {
    const { orderId, nextStatus, callerId, callerRole, rejectionReason } = input;

    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Access control — only participants can touch an order
    this.assertParticipant(order, callerId, callerRole);

    // Terminal guard
    if (isTerminal(order.status)) {
      throw new ForbiddenError(`Order ${order.orderNumber} is in a terminal state (${order.status}) and cannot be modified`);
    }

    // State machine guard (also checks role permission for the transition)
    assertTransition(order.status, nextStatus, callerRole);

    // Validate business-level preconditions
    if (nextStatus === OrderStatus.REJECTED && !rejectionReason?.trim()) {
      throw new ForbiddenError('A rejection reason is required when rejecting an order');
    }

    // Build update
    const update: Record<string, unknown> = { status: nextStatus };

    const tsField = STATUS_TIMESTAMP_FIELDS[nextStatus];
    if (tsField) {
      update[tsField as string] = new Date();
    }

    if (nextStatus === OrderStatus.REJECTED) {
      update['rejectionReason'] = rejectionReason;
    }

    const updated = await orderRepository.updateById(orderId, update);
    if (!updated) {
      throw new NotFoundError('Order not found');
    }

    // ── Async side-effects (NOT in the HTTP request lifecycle) ────────────────
    void Promise.allSettled([
      enqueueEmail({
        name: 'send-order-status-update',
        jobId: newJobId(),
        to: '',
        recipientName: '',
        orderNumber: order.orderNumber,
        orderId: orderId,
        previousStatus: order.status,
        newStatus: nextStatus,
        ...(rejectionReason !== undefined ? { rejectionReason } : {}),
      }),
      // Notify both parties of the status change
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: order.buyerId.toString(),
        type: NotificationType.ORDER_UPDATE,
        title: `Order ${order.orderNumber} Updated`,
        message: `Your order status changed to ${nextStatus}.`,
        referenceEntityType: 'ORDER',
        referenceEntityId: orderId,
        pushViaSocket: true,
      }),
      enqueueNotification({
        name: 'create-notification',
        jobId: newJobId(),
        userId: order.sellerId.toString(),
        type: NotificationType.ORDER_UPDATE,
        title: `Order ${order.orderNumber} Updated`,
        message: `Order ${order.orderNumber} status changed to ${nextStatus}.`,
        referenceEntityType: 'ORDER',
        referenceEntityId: orderId,
        pushViaSocket: true,
      }),
    ]);

    return updated;
  }

  /** Retrieve a single order, enforcing that the caller is a participant. */
  async getOrder(
    orderId: string,
    callerId: string,
    callerRole: UserRole,
  ): Promise<IOrderDocument> {
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    this.assertParticipant(order, callerId, callerRole);
    return order;
  }

  /** List orders scoped to the caller (airline sees their purchases, supplier sees their sales). */
  async listOrders(
    callerId: string,
    callerRole: UserRole,
    filter: Omit<OrderFilter, 'buyerId' | 'sellerId'>,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IOrderDocument>> {
    let scopedFilter: OrderFilter;

    if (callerRole === UserRole.ADMIN) {
      scopedFilter = { ...filter };
    } else if (callerRole === UserRole.AIRLINE) {
      scopedFilter = { ...filter, buyerId: callerId };
    } else if (callerRole === UserRole.SUPPLIER) {
      scopedFilter = { ...filter, sellerId: callerId };
    } else {
      throw new ForbiddenError('Only airlines, suppliers and admins can access orders');
    }

    return orderRepository.filterOrders(scopedFilter, options);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private assertParticipant(
    order: IOrderDocument,
    callerId: string,
    callerRole: UserRole,
  ): void {
    if (callerRole === UserRole.ADMIN) return;

    const isBuyer  = order.buyerId.toString()  === callerId;
    const isSeller = order.sellerId.toString() === callerId;

    if (!isBuyer && !isSeller) {
      throw new NotFoundError('Order not found');
    }
  }
}

export const orderService = new OrderService();
