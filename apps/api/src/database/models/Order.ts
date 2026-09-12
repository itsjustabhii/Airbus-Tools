import { OrderStatus, type OrderItem, type OrderShippingAddress } from '@airbus-tools/shared';
import { Schema, model, type Document, type Types } from 'mongoose';

export interface IOrderDocument extends Document {
  orderNumber: string;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  shippingAddress: OrderShippingAddress;
  notes?: string;
  placedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<OrderItem>(
  {
    productId: {
      type: String,
      required: true,
    },
    partNumber: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative'],
    },
  },
  { _id: false },
);

const OrderShippingAddressSchema = new Schema<OrderShippingAddress>(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true, default: null },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },
  { _id: false },
);

/**
 * Order Schema definition
 * 
 * Index Rationale:
 * 1. { orderNumber: 1 } (Unique)
 *    - Query Pattern: Tracking, invoicing, and direct lookup by human-readable unique order code (e.g. ORD-2025-001).
 *    - Rationale: High selectivity, unique business identifier.
 * 2. { buyerId: 1, status: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: Buyer order history and dashboard listing with status filter and reverse chronological ordering.
 *    - Rationale: Optimal compound index following Equality, Sort, Range (ESR) rule.
 * 3. { sellerId: 1, status: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: Seller order fulfillment board, incoming RFQs/orders management.
 *    - Rationale: Matches seller-side query workloads with fast sort performance.
 * 4. { status: 1, createdAt: 1 } (Compound)
 *    - Query Pattern: Background worker scanning for pending/stale orders to cancel or remind.
 *    - Rationale: Queue-style FIFO / state-based batch processing.
 */
export const OrderSchema = new Schema<IOrderDocument>(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer ID is required'],
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller ID is required'],
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
      default: OrderStatus.DRAFT,
    },
    items: {
      type: [OrderItemSchema],
      required: [true, 'Order items are required'],
      validate: {
        validator: (v: OrderItem[]) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative'],
    },
    tax: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Tax cannot be negative'],
    },
    shippingFee: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Shipping fee cannot be negative'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD',
      length: 3,
    },
    shippingAddress: {
      type: OrderShippingAddressSchema,
      required: [true, 'Shipping address is required'],
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    placedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const result = ret as Record<string, unknown>;
        result.id = (result._id as { toString(): string }).toString();
        if (result.buyerId) {
          result.buyerId = (result.buyerId as { toString(): string }).toString();
        }
        if (result.sellerId) {
          result.sellerId = (result.sellerId as { toString(): string }).toString();
        }
        delete result._id;
        delete result.__v;
        return result;
      },
    },
  },
);

OrderSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: 1 });

export const OrderModel = model<IOrderDocument>('Order', OrderSchema);
