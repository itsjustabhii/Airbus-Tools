import { InteractionType } from '@airbus-tools/shared';
import type { FilterQuery } from 'mongoose';

import { InteractionModel, type IInteractionDocument } from '../models/Interaction';

import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';

export interface InteractionAnalyticsQuery {
  entityType?: 'PRODUCT' | 'ORDER' | 'USER' | 'SEARCH';
  entityId?: string;
  type?: InteractionType;
  startDate?: Date;
  endDate?: Date;
}

export class InteractionRepository extends BaseRepository<IInteractionDocument> {
  constructor() {
    super(InteractionModel);
  }

  public async logInteraction(data: {
    userId?: string;
    anonymousId?: string;
    type: InteractionType;
    entityType: 'PRODUCT' | 'ORDER' | 'USER' | 'SEARCH';
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<IInteractionDocument> {
    return this.create(data as unknown as Partial<IInteractionDocument>);
  }

  public async findByUser(
    userId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IInteractionDocument>> {
    return this.findPaginated({ userId }, options);
  }

  public async findByAnonymousId(
    anonymousId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IInteractionDocument>> {
    return this.findPaginated({ anonymousId }, options);
  }

  public async countEntityInteractions(
    entityType: 'PRODUCT' | 'ORDER' | 'USER' | 'SEARCH',
    entityId: string,
    type?: InteractionType,
  ): Promise<number> {
    const filter: FilterQuery<IInteractionDocument> = { entityType, entityId };
    if (type) {
      filter.type = type;
    }
    return this.count(filter);
  }

  public async getProductViewCounts(productIds: string[]): Promise<Array<{ _id: string; count: number }>> {
    return this.model.aggregate([
      {
        $match: {
          entityType: 'PRODUCT',
          entityId: { $in: productIds },
          type: InteractionType.VIEW,
        },
      },
      {
        $group: {
          _id: '$entityId',
          count: { $sum: 1 },
        },
      },
    ]);
  }
}

export const interactionRepository = new InteractionRepository();
