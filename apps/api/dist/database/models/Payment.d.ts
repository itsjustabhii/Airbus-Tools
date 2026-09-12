import { PaymentMethod, PaymentStatus } from '@airbus-tools/shared';
import { Schema, type Document, type Types } from 'mongoose';
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
export declare const PaymentSchema: Schema<IPaymentDocument, import("mongoose").Model<IPaymentDocument, any, any, any, Document<unknown, any, IPaymentDocument, any, {}> & IPaymentDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IPaymentDocument, Document<unknown, {}, import("mongoose").FlatRecord<IPaymentDocument>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<IPaymentDocument> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const PaymentModel: import("mongoose").Model<IPaymentDocument, {}, {}, {}, Document<unknown, {}, IPaymentDocument, {}, {}> & IPaymentDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Payment.d.ts.map