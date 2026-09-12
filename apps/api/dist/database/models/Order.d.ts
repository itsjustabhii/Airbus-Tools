import { OrderStatus, type OrderItem, type OrderShippingAddress } from '@airbus-tools/shared';
import { Schema, type Document, type Types } from 'mongoose';
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
export declare const OrderSchema: Schema<IOrderDocument, import("mongoose").Model<IOrderDocument, any, any, any, Document<unknown, any, IOrderDocument, any, {}> & IOrderDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IOrderDocument, Document<unknown, {}, import("mongoose").FlatRecord<IOrderDocument>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<IOrderDocument> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const OrderModel: import("mongoose").Model<IOrderDocument, {}, {}, {}, Document<unknown, {}, IOrderDocument, {}, {}> & IOrderDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Order.d.ts.map