/**
 * InteractionService
 *
 * Records airline-relevant interactions with products/suppliers:
 *   - viewed       → InteractionType.VIEW
 *   - contacted    → InteractionType.INQUIRY
 *   - requested    → InteractionType.RFQ
 *   - ordered      → mapped to entityType ORDER
 *
 * The service wraps InteractionRepository so callers use domain verbs
 * rather than raw enum values.
 */
import type { IInteractionDocument } from '../database/models/Interaction';
export interface RecordInteractionOptions {
    userId?: string;
    anonymousId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}
export declare class InteractionService {
    /** Build a partial options object omitting undefined-valued optional fields. */
    private static buildInteractionOpts;
    /** Record that a user viewed a product listing. */
    recordViewed(productId: string, opts?: RecordInteractionOptions): Promise<IInteractionDocument>;
    /** Record that a user sent a direct inquiry to a supplier about a product. */
    recordContacted(productId: string, opts?: RecordInteractionOptions): Promise<IInteractionDocument>;
    /** Record that a user submitted an RFQ (Request For Quotation) for a product. */
    recordRequested(productId: string, opts?: RecordInteractionOptions): Promise<IInteractionDocument>;
    /** Record that a user placed an order (entityType = ORDER, entityId = orderId). */
    recordOrdered(orderId: string, opts?: RecordInteractionOptions): Promise<IInteractionDocument>;
    /**
     * Return the set of product IDs with which this user has *any* interaction.
     * Used by the recommendation engine to drive $nin exclusion.
     */
    getInteractedProductIds(userId: string): Promise<string[]>;
}
export declare const interactionService: InteractionService;
//# sourceMappingURL=interactionService.d.ts.map