"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentModel = exports.PaymentSchema = void 0;
const shared_1 = require("@airbus-tools/shared");
const mongoose_1 = require("mongoose");
/**
 * Payment Schema definition
 *
 * Index Rationale:
 * 1. { paymentNumber: 1 } (Unique)
 *    - Query Pattern: Direct receipt / invoice tracking and accounting lookup.
 *    - Rationale: High selectivity, unique transaction identifier.
 * 2. { orderId: 1 }
 *    - Query Pattern: Finding payment details/escrow record for a specific order.
 *    - Rationale: High-frequency relationship join between orders and payments.
 * 3. { payerId: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: Buyer billing history and statement generation.
 *    - Rationale: Reverse chronological payment listing for buyers.
 * 4. { payeeId: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: Seller disbursement history and earnings dashboard.
 *    - Rationale: Reverse chronological payment listing for sellers.
 * 5. { status: 1, createdAt: 1 } (Compound)
 *    - Query Pattern: Reconciling pending payments or processing escrow payouts.
 *    - Rationale: Queue-style worker polling for uncompleted payment statuses.
 */
exports.PaymentSchema = new mongoose_1.Schema({
    paymentNumber: {
        type: String,
        required: [true, 'Payment number is required'],
        unique: true,
        trim: true,
        uppercase: true,
    },
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Order',
        required: [true, 'Order ID is required'],
    },
    payerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Payer ID is required'],
    },
    payeeId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Payee ID is required'],
    },
    amount: {
        type: Number,
        required: [true, 'Payment amount is required'],
        min: [0, 'Amount cannot be negative'],
    },
    currency: {
        type: String,
        required: true,
        uppercase: true,
        default: 'USD',
        length: 3,
    },
    paymentMethod: {
        type: String,
        enum: Object.values(shared_1.PaymentMethod),
        required: [true, 'Payment method is required'],
    },
    status: {
        type: String,
        enum: Object.values(shared_1.PaymentStatus),
        required: true,
        default: shared_1.PaymentStatus.PENDING,
    },
    providerPaymentId: {
        type: String,
        trim: true,
        default: null,
    },
    idempotencyKey: {
        type: String,
        trim: true,
        default: null,
    },
    transactionReference: {
        type: String,
        trim: true,
        default: null,
    },
    gatewayResponse: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    failureReason: {
        type: String,
        trim: true,
        default: null,
    },
    paidAt: {
        type: Date,
        default: null,
    },
    refundedAt: {
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
            if (result.orderId) {
                result.orderId = result.orderId.toString();
            }
            if (result.payerId) {
                result.payerId = result.payerId.toString();
            }
            if (result.payeeId) {
                result.payeeId = result.payeeId.toString();
            }
            delete result._id;
            delete result.__v;
            return result;
        },
    },
});
exports.PaymentSchema.index({ providerPaymentId: 1 }, { sparse: true });
exports.PaymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
exports.PaymentSchema.index({ orderId: 1 });
exports.PaymentSchema.index({ payerId: 1, createdAt: -1 });
exports.PaymentSchema.index({ payeeId: 1, createdAt: -1 });
exports.PaymentSchema.index({ status: 1, createdAt: 1 });
exports.PaymentModel = (0, mongoose_1.model)('Payment', exports.PaymentSchema);
//# sourceMappingURL=Payment.js.map