import type { OrderStatus } from '@airbus-tools/shared';
import { type IOrderDocument } from '../models/Order';
import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';
export interface OrderFilter {
    buyerId?: string;
    sellerId?: string;
    status?: OrderStatus;
    startDate?: Date;
    endDate?: Date;
}
export declare class OrderRepository extends BaseRepository<IOrderDocument> {
    constructor();
    findByOrderNumber(orderNumber: string): Promise<IOrderDocument | null>;
    findByBuyer(buyerId: string, status?: OrderStatus, options?: PaginationOptions): Promise<PaginatedResult<IOrderDocument>>;
    findBySeller(sellerId: string, status?: OrderStatus, options?: PaginationOptions): Promise<PaginatedResult<IOrderDocument>>;
    updateStatus(id: string, status: OrderStatus, statusDateFields?: {
        placedAt?: Date;
        completedAt?: Date;
        cancelledAt?: Date;
    }): Promise<IOrderDocument | null>;
    filterOrders(filter: OrderFilter, options?: PaginationOptions): Promise<PaginatedResult<IOrderDocument>>;
}
export declare const orderRepository: OrderRepository;
//# sourceMappingURL=OrderRepository.d.ts.map