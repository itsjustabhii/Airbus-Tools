"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationRepository = exports.ConversationRepository = void 0;
const Conversation_1 = require("../models/Conversation");
const BaseRepository_1 = require("./BaseRepository");
const shared_1 = require("@airbus-tools/shared");
class ConversationRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super(Conversation_1.ConversationModel);
    }
    async findUserConversations(userId, options) {
        return this.findPaginated({ 'participants.userId': userId }, { sort: { lastMessageAt: -1 }, ...options });
    }
    async findByOrder(orderId) {
        return this.findOne({ orderId });
    }
    async findByProductAndUsers(productId, participantUserIds) {
        return this.findOne({
            productId,
            'participants.userId': { $all: participantUserIds },
        });
    }
    async updateLastMessage(conversationId, snippet, timestamp = new Date()) {
        return this.updateById(conversationId, {
            lastMessageSnippet: snippet,
            lastMessageAt: timestamp,
        });
    }
    async updateParticipantReadTimestamp(conversationId, userId, readAt = new Date()) {
        return this.model
            .findOneAndUpdate({ _id: conversationId, 'participants.userId': userId }, { $set: { 'participants.$.lastReadAt': readAt } }, { new: true })
            .exec();
    }
    async findDirectConversation(userA, userB) {
        return this.findOne({
            type: shared_1.ConversationType.DIRECT,
            'participants.userId': { $all: [userA, userB] },
        });
    }
}
exports.ConversationRepository = ConversationRepository;
exports.conversationRepository = new ConversationRepository();
//# sourceMappingURL=ConversationRepository.js.map