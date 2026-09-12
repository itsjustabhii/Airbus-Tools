import { InteractionType } from '@airbus-tools/shared';
import { type IInteractionDocument } from '../models/Interaction';
import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';
export interface InteractionAnalyticsQuery {
    entityType?: 'PRODUCT' | 'ORDER' | 'USER' | 'SEARCH';
    entityId?: string;
    type?: InteractionType;
    startDate?: Date;
    endDate?: Date;
}
export declare class InteractionRepository extends BaseRepository<IInteractionDocument> {
    constructor();
    logInteraction(data: {
        userId?: string;
        anonymousId?: string;
        type: InteractionType;
        entityType: 'PRODUCT' | 'ORDER' | 'USER' | 'SEARCH';
        entityId?: string;
        metadata?: Record<string, unknown>;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<IInteractionDocument>;
    findByUser(userId: string, options?: PaginationOptions): Promise<PaginatedResult<IInteractionDocument>>;
    findByAnonymousId(anonymousId: string, options?: PaginationOptions): Promise<PaginatedResult<IInteractionDocument>>;
    countEntityInteractions(entityType: 'PRODUCT' | 'ORDER' | 'USER' | 'SEARCH', entityId: string, type?: InteractionType): Promise<number>;
    getProductViewCounts(productIds: string[]): Promise<Array<{
        _id: string;
        count: number;
    }>>;
}
export declare const interactionRepository: InteractionRepository;
//# sourceMappingURL=InteractionRepository.d.ts.map