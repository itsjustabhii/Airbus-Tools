import { PaymentMethod, PaymentStatus } from '@airbus-tools/shared';
import { Schema, model, type Document, type Types } from 'mongoose';

export interface IPaymentDocument extends Document {
  paymentNumber: string;
  orderId: Types.ObjectId;
  payerId: Types.ObjectId;
  payeeId: Types.ObjectId;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  gatewayResponse?: Record<string, unknown>;
  failureReason?: string;
  paidAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
export const PaymentSchema = new Schema<IPaymentDocument>(
  {
    paymentNumber: {
      type: String,
      required: [true, 'Payment number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
    },
    payerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payer ID is required'],
    },
    payeeId: {
      type: Schema.Types.ObjectId,
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
      enum: Object.values(PaymentMethod),
      required: [true, 'Payment method is required'],
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true,
      default: PaymentStatus.PENDING,
    },
    transactionReference: {
      type: String,
      trim: true,
      default: null,
    },
    gatewayResponse: {
      type: Schema.Types.Mixed,
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
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const result = ret as Record<string, unknown>;
        result.id = (result._id as { toString(): string }).toString();
        if (result.orderId) {
          result.orderId = (result.orderId as { toString(): string }).toString();
        }
        if (result.payerId) {
          result.payerId = (result.payerId as { toString(): string }).toString();
        }
        if (result.payeeId) {
          result.payeeId = (result.payeeId as { toString(): string }).toString();
        }
        delete result._id;
        delete result.__v;
        return result;
      },
    },
  },
);

PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ payerId: 1, createdAt: -1 });
PaymentSchema.index({ payeeId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: 1 });

export const PaymentModel = model<IPaymentDocument>('Payment', PaymentSchema);
