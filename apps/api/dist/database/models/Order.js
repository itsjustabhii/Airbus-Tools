"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderModel = exports.OrderSchema = void 0;
const shared_1 = require("@airbus-tools/shared");
const mongoose_1 = require("mongoose");
const OrderItemSchema = new mongoose_1.Schema({
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
    currency: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
    },
}, { _id: false });
const OrderShippingAddressSchema = new mongoose_1.Schema({
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true, default: null },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
}, { _id: false });
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
exports.OrderSchema = new mongoose_1.Schema({
    orderNumber: {
        type: String,
        required: [true, 'Order number is required'],
        unique: true,
        trim: true,
        uppercase: true,
    },
    buyerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Buyer ID is required'],
    },
    sellerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Seller ID is required'],
    },
    status: {
        type: String,
        enum: Object.values(shared_1.OrderStatus),
        required: true,
        default: shared_1.OrderStatus.PENDING,
    },
    items: {
        type: [OrderItemSchema],
        required: [true, 'Order items are required'],
        validate: {
            validator: (v) => Array.isArray(v) && v.length > 0,
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
    rejectionReason: {
        type: String,
        trim: true,
        default: null,
    },
    placedAt: {
        type: Date,
        default: null,
    },
    acceptedAt: {
        type: Date,
        default: null,
    },
    rejectedAt: {
        type: Date,
        default: null,
    },
    paidAt: {
        type: Date,
        default: null,
    },
    completedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            const result = ret;
            result.id = result._id.toString();
            if (result.buyerId) {
                result.buyerId = result.buyerId.toString();
            }
            if (result.sellerId) {
                result.sellerId = result.sellerId.toString();
            }
            delete result._id;
            delete result.__v;
            return result;
        },
    },
});
exports.OrderSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
exports.OrderSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
exports.OrderSchema.index({ status: 1, createdAt: 1 });
exports.OrderModel = (0, mongoose_1.model)('Order', exports.OrderSchema);
//# sourceMappingURL=Order.js.map