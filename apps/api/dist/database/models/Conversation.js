"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationModel = exports.ConversationSchema = void 0;
const shared_1 = require("@airbus-tools/shared");
const mongoose_1 = require("mongoose");
const ConversationParticipantSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    lastReadAt: {
        type: Date,
        default: null,
    },
}, { _id: false });
/**
 * Conversation Schema definition
 *
 * Index Rationale:
 * 1. { 'participants.userId': 1, lastMessageAt: -1 } (Compound / Multikey)
 *    - Query Pattern: User inbox listing — finding all active threads for a specific user ordered by latest activity.
 *    - Rationale: Most frequent inbox view; multikey index on participant user IDs efficiently sorts conversations without in-memory sort.
 * 2. { orderId: 1 } (Sparse)
 *    - Query Pattern: Contextual messaging linking buyer and seller directly to an order transaction thread.
 *    - Rationale: Quick direct retrieval of the transaction chat thread.
 * 3. { productId: 1 } (Sparse)
 *    - Query Pattern: Contextual messaging regarding a specific catalog product or RFQ inquiry.
 *    - Rationale: Direct lookup of pre-sale product inquiries.
 */
exports.ConversationSchema = new mongoose_1.Schema({
    participants: {
        type: [ConversationParticipantSchema],
        required: [true, 'Participants are required'],
        validate: {
            validator: (v) => Array.isArray(v) && v.length >= 2,
            message: 'A conversation must have at least two participants',
        },
    },
    type: {
        type: String,
        enum: Object.values(shared_1.ConversationType),
        required: true,
        default: shared_1.ConversationType.DIRECT,
    },
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        default: null,
    },
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Order',
        default: null,
    },
    lastMessageAt: {
        type: Date,
        default: Date.now,
    },
    lastMessageSnippet: {
        type: String,
        trim: true,
        maxlength: [300, 'Snippet cannot exceed 300 characters'],
        default: null,
    },
    title: {
        type: String,
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
        default: null,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            const result = ret;
            result.id = result._id.toString();
            if (result.productId) {
                result.productId = result.productId.toString();
            }
            if (result.orderId) {
                result.orderId = result.orderId.toString();
            }
            if (Array.isArray(result.participants)) {
                result.participants = result.participants.map((p) => ({
                    ...p,
                    userId: p.userId?.toString(),
                }));
            }
            delete result._id;
            delete result.__v;
            return result;
        },
    },
});
exports.ConversationSchema.index({ 'participants.userId': 1, lastMessageAt: -1 });
exports.ConversationSchema.index({ orderId: 1 }, { sparse: true });
exports.ConversationSchema.index({ productId: 1 }, { sparse: true });
exports.ConversationModel = (0, mongoose_1.model)('Conversation', exports.ConversationSchema);
//# sourceMappingURL=Conversation.js.map