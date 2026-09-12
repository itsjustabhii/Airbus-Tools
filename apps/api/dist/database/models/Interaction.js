"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionModel = exports.InteractionSchema = void 0;
const shared_1 = require("@airbus-tools/shared");
const mongoose_1 = require("mongoose");
/**
 * Interaction Schema definition
 *
 * Index Rationale:
 * 1. { userId: 1, createdAt: -1 } (Compound / Sparse)
 *    - Query Pattern: User behavioral analytics, recommendation engine history, audit log of actions.
 *    - Rationale: Time-series user journey tracking.
 * 2. { entityType: 1, entityId: 1, type: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: Product view counts, conversion rate calculations, RFQ interest metrics.
 *    - Rationale: Fast aggregation and analytics on entity-level interactions.
 * 3. { anonymousId: 1, createdAt: -1 } (Compound / Sparse)
 *    - Query Pattern: Stitching guest user browsing sessions once they register or log in.
 *    - Rationale: Unauthenticated funnel analytics.
 * 4. { createdAt: 1 } (TTL or Log Partitioning)
 *    - Query Pattern: Time-range queries for daily/weekly BI aggregation and metrics reporting.
 *    - Rationale: Fast time-window filtering.
 */
exports.InteractionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    anonymousId: {
        type: String,
        trim: true,
        default: null,
    },
    type: {
        type: String,
        enum: Object.values(shared_1.InteractionType),
        required: [true, 'Interaction type is required'],
    },
    entityType: {
        type: String,
        enum: ['PRODUCT', 'ORDER', 'USER', 'SEARCH'],
        required: [true, 'Entity type is required'],
    },
    entityId: {
        type: String,
        trim: true,
        default: null,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
    ipAddress: {
        type: String,
        trim: true,
        default: null,
    },
    userAgent: {
        type: String,
        trim: true,
        default: null,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            const result = ret;
            result.id = result._id.toString();
            if (result.userId) {
                result.userId = result.userId.toString();
            }
            delete result._id;
            delete result.__v;
            return result;
        },
    },
});
exports.InteractionSchema.index({ userId: 1, createdAt: -1 }, { sparse: true });
exports.InteractionSchema.index({ entityType: 1, entityId: 1, type: 1, createdAt: -1 });
exports.InteractionSchema.index({ anonymousId: 1, createdAt: -1 }, { sparse: true });
exports.InteractionSchema.index({ createdAt: 1 });
exports.InteractionModel = (0, mongoose_1.model)('Interaction', exports.InteractionSchema);
//# sourceMappingURL=Interaction.js.map