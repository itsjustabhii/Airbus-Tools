"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionRepository = exports.InteractionRepository = void 0;
const Interaction_1 = require("../models/Interaction");
const BaseRepository_1 = require("./BaseRepository");
const shared_1 = require("@airbus-tools/shared");
class InteractionRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super(Interaction_1.InteractionModel);
    }
    async logInteraction(data) {
        return this.create(data);
    }
    async findByUser(userId, options) {
        return this.findPaginated({ userId }, options);
    }
    async findByAnonymousId(anonymousId, options) {
        return this.findPaginated({ anonymousId }, options);
    }
    async countEntityInteractions(entityType, entityId, type) {
        const filter = { entityType, entityId };
        if (type) {
            filter.type = type;
        }
        return this.count(filter);
    }
    async getProductViewCounts(productIds) {
        return this.model.aggregate([
            {
                $match: {
                    entityType: 'PRODUCT',
                    entityId: { $in: productIds },
                    type: shared_1.InteractionType.VIEW,
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
exports.InteractionRepository = InteractionRepository;
exports.interactionRepository = new InteractionRepository();
//# sourceMappingURL=InteractionRepository.js.map