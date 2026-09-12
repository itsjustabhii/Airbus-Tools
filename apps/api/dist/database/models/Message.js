"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageModel = exports.MessageSchema = void 0;
const mongoose_1 = require("mongoose");
const shared_1 = require("@airbus-tools/shared");
const MessageAttachmentSchema = new mongoose_1.Schema({
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true, min: [0, 'File size cannot be negative'] },
    mimeType: { type: String, required: true },
}, { _id: false });
/**
 * Message Schema definition
 *
 * Index Rationale:
 * 1. { conversationId: 1, createdAt: 1 } (Compound)
 *    - Query Pattern: Chat message stream retrieval with pagination (infinite scroll / chronological conversation history).
 *    - Rationale: High query frequency; avoids collection scans and in-memory sorting for chat views.
 * 2. { senderId: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: User message activity tracking and moderation review of recent outbound messages.
 *    - Rationale: Fast user activity lookup.
 */
exports.MessageSchema = new mongoose_1.Schema({
    conversationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: [true, 'Conversation ID is required'],
    },
    senderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Sender ID is required'],
    },
    type: {
        type: String,
        enum: Object.values(shared_1.MessageType),
        required: true,
        default: shared_1.MessageType.TEXT,
    },
    content: {
        type: String,
        required: [true, 'Message content is required'],
        trim: true,
        maxlength: [10000, 'Message cannot exceed 10000 characters'],
    },
    attachments: {
        type: [MessageAttachmentSchema],
        default: [],
    },
    isReadBy: {
        type: [
            {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        default: [],
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.id = ret._id.toString();
            ret.conversationId = ret.conversationId?.toString();
            ret.senderId = ret.senderId?.toString();
            if (Array.isArray(ret.isReadBy)) {
                ret.isReadBy = ret.isReadBy.map((id) => id?.toString());
            }
            delete ret._id;
            delete ret.__v;
            return ret;
        },
    },
});
exports.MessageSchema.index({ conversationId: 1, createdAt: 1 });
exports.MessageSchema.index({ senderId: 1, createdAt: -1 });
exports.MessageModel = (0, mongoose_1.model)('Message', exports.MessageSchema);
//# sourceMappingURL=Message.js.map