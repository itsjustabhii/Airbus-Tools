import type { OrderStatus } from '@airbus-tools/shared';
import type { FilterQuery } from 'mongoose';

import { OrderModel, type IOrderDocument } from '../models/Order';

import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';

export interface OrderFilter {
  buyerId?: string;
  sellerId?: string;
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
}

export class OrderRepository extends BaseRepository<IOrderDocument> {
  constructor() {
    super(OrderModel);
  }

  public async findByOrderNumber(orderNumber: string): Promise<IOrderDocument | null> {
    return this.findOne({ orderNumber: orderNumber.toUpperCase().trim() });
  }

  public async findByBuyer(
    buyerId: string,
    status?: OrderStatus,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IOrderDocument>> {
    const filter: FilterQuery<IOrderDocument> = { buyerId };
    if (status) {
      filter.status = status;
    }
    return this.findPaginated(filter, options);
  }

  public async findBySeller(
    sellerId: string,
    status?: OrderStatus,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IOrderDocument>> {
    const filter: FilterQuery<IOrderDocument> = { sellerId };
    if (status) {
      filter.status = status;
    }
    return this.findPaginated(filter, options);
  }

  public async updateStatus(
    id: string,
    status: OrderStatus,
    statusDateFields?: { placedAt?: Date; completedAt?: Date; cancelledAt?: Date },
  ): Promise<IOrderDocument | null> {
    const update: Record<string, unknown> = { status };
    if (statusDateFields) {
      Object.assign(update, statusDateFields);
    }
    return this.updateById(id, update);
  }

  public async filterOrders(
    filter: OrderFilter,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IOrderDocument>> {
    const query: FilterQuery<IOrderDocument> = {};

    if (filter.buyerId) {
      query.buyerId = filter.buyerId;
    }
    if (filter.sellerId) {
      query.sellerId = filter.sellerId;
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.startDate || filter.endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (filter.startDate) {
        dateFilter.$gte = filter.startDate;
      }
      if (filter.endDate) {
        dateFilter.$lte = filter.endDate;
      }
      query.createdAt = dateFilter;
    }

    return this.findPaginated(query, options);
  }
}

export const orderRepository = new OrderRepository();
