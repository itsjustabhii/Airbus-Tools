"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionService = exports.InteractionService = void 0;
const shared_1 = require("@airbus-tools/shared");
const InteractionRepository_1 = require("../database/repositories/InteractionRepository");
class InteractionService {
    /** Build a partial options object omitting undefined-valued optional fields. */
    static buildInteractionOpts(opts) {
        return {
            ...(opts.userId !== undefined && { userId: opts.userId }),
            ...(opts.anonymousId !== undefined && { anonymousId: opts.anonymousId }),
            ...(opts.ipAddress !== undefined && { ipAddress: opts.ipAddress }),
            ...(opts.userAgent !== undefined && { userAgent: opts.userAgent }),
            ...(opts.metadata !== undefined && { metadata: opts.metadata }),
        };
    }
    /** Record that a user viewed a product listing. */
    async recordViewed(productId, opts = {}) {
        return InteractionRepository_1.interactionRepository.logInteraction({
            ...InteractionService.buildInteractionOpts(opts),
            type: shared_1.InteractionType.VIEW,
            entityType: 'PRODUCT',
            entityId: productId,
        });
    }
    /** Record that a user sent a direct inquiry to a supplier about a product. */
    async recordContacted(productId, opts = {}) {
        return InteractionRepository_1.interactionRepository.logInteraction({
            ...InteractionService.buildInteractionOpts(opts),
            type: shared_1.InteractionType.INQUIRY,
            entityType: 'PRODUCT',
            entityId: productId,
        });
    }
    /** Record that a user submitted an RFQ (Request For Quotation) for a product. */
    async recordRequested(productId, opts = {}) {
        return InteractionRepository_1.interactionRepository.logInteraction({
            ...InteractionService.buildInteractionOpts(opts),
            type: shared_1.InteractionType.RFQ,
            entityType: 'PRODUCT',
            entityId: productId,
        });
    }
    /** Record that a user placed an order (entityType = ORDER, entityId = orderId). */
    async recordOrdered(orderId, opts = {}) {
        return InteractionRepository_1.interactionRepository.logInteraction({
            ...InteractionService.buildInteractionOpts(opts),
            type: shared_1.InteractionType.RFQ,
            entityType: 'ORDER',
            entityId: orderId,
        });
    }
    /**
     * Return the set of product IDs with which this user has *any* interaction.
     * Used by the recommendation engine to drive $nin exclusion.
     */
    async getInteractedProductIds(userId) {
        const docs = await InteractionRepository_1.interactionRepository.find({
            userId,
            entityType: 'PRODUCT',
        });
        return [...new Set(docs.map((d) => d.entityId).filter((id) => id != null))];
    }
}
exports.InteractionService = InteractionService;
exports.interactionService = new InteractionService();
//# sourceMappingURL=interactionService.js.map