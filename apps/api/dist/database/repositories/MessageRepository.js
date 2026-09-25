"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRepository = exports.MessageRepository = void 0;
const Message_1 = require("../models/Message");
const BaseRepository_1 = require("./BaseRepository");
class MessageRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super(Message_1.MessageModel);
    }
    async findByConversation(conversationId, options) {
        return this.findPaginated({ conversationId }, { sort: { createdAt: 1 }, ...options });
    }
    async findRecentMessages(conversationId, limit = 50) {
        return this.model
            .find({ conversationId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .exec();
    }
    async markAsRead(messageIds, userId) {
        const result = await this.model
            .updateMany({ _id: { $in: messageIds }, isReadBy: { $ne: userId } }, { $addToSet: { isReadBy: userId } })
            .exec();
        return { modifiedCount: result.modifiedCount };
    }
    async markAllInConversationAsRead(conversationId, userId) {
        const result = await this.model
            .updateMany({ conversationId, isReadBy: { $ne: userId } }, { $addToSet: { isReadBy: userId } })
            .exec();
        return { modifiedCount: result.modifiedCount };
    }
    async countUnreadInConversation(conversationId, userId) {
        return this.count({
            conversationId,
            senderId: { $ne: userId },
            isReadBy: { $ne: userId },
        });
    }
    /** Raw chronological query used by REST and WebSocket message-history endpoints. */
    async findRaw(query, limit) {
        return this.model.find(query).sort({ createdAt: 1 }).limit(limit).exec();
    }
}
exports.MessageRepository = MessageRepository;
exports.messageRepository = new MessageRepository();
//# sourceMappingURL=MessageRepository.js.map