import { OrderStatus, UserRole } from '@airbus-tools/shared';
import { type IOrderDocument } from '../database/models/Order';
import type { PaginatedResult, PaginationOptions } from '../database/repositories/BaseRepository';
import { type OrderFilter } from '../database/repositories/OrderRepository';
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
export declare class OrderService {
    /**
     * Airlines submit a new order request.
     *
     * Price snapshot:
     *   Each item's unitPrice and currency are copied from the Product document
     *   at the moment the order is created. This snapshot is immutable — future
     *   product price changes do NOT affect existing orders.
     */
    createOrder(input: CreateOrderInput): Promise<IOrderDocument>;
    /**
     * Advance an order through the state machine.
     *
     * Ownership rules:
     * - Only the buying AIRLINE or an ADMIN may view/act on buyer-side transitions.
     * - Only the selling SUPPLIER or an ADMIN may view/act on supplier-side transitions.
     * - Neither party may modify orders they are not a participant in.
     * - Completed/rejected orders are immutable.
     */
    transitionOrder(input: TransitionOrderInput): Promise<IOrderDocument>;
    /** Retrieve a single order, enforcing that the caller is a participant. */
    getOrder(orderId: string, callerId: string, callerRole: UserRole): Promise<IOrderDocument>;
    /** List orders scoped to the caller (airline sees their purchases, supplier sees their sales). */
    listOrders(callerId: string, callerRole: UserRole, filter: Omit<OrderFilter, 'buyerId' | 'sellerId'>, options?: PaginationOptions): Promise<PaginatedResult<IOrderDocument>>;
    private assertParticipant;
}
export declare const orderService: OrderService;
//# sourceMappingURL=orderService.d.ts.map