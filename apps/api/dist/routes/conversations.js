"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationsRouter = void 0;
const express_1 = require("express");
const shared_1 = require("@airbus-tools/shared");
const errors_1 = require("../core/errors");
const response_1 = require("../core/response");
const ConversationRepository_1 = require("../database/repositories/ConversationRepository");
const MessageRepository_1 = require("../database/repositories/MessageRepository");
const authenticate_1 = require("../middlewares/authenticate");
const utils_1 = require("../sockets/utils");
const router = (0, express_1.Router)();
exports.conversationsRouter = router;
// Require authentication for all conversation endpoints
router.use(authenticate_1.authenticate);
/**
 * GET /api/v1/conversations
 * Retrieve all conversations for the authenticated user, enriched with unread counts.
 */
router.get('/', (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user.sub;
            const result = await ConversationRepository_1.conversationRepository.findUserConversations(userId, { limit: 100 });
            const conversations = await Promise.all(result.items.map(async (conv) => {
                const convJson = conv.toJSON();
                const unreadCount = await MessageRepository_1.messageRepository.countUnreadInConversation(conv.id, userId);
                return {
                    ...convJson,
                    unreadCount,
                    roomId: (0, utils_1.getConversationRoomId)(conv),
                };
            }));
            res.status(200).json((0, response_1.successResponse)({ conversations }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * POST /api/v1/conversations
 * Find or create a direct conversation with another user.
 */
router.post('/', (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user.sub;
            const { recipientId } = req.body;
            if (!recipientId) {
                res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'recipientId is required' } });
                return;
            }
            if (recipientId === userId) {
                res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Cannot start a conversation with yourself' } });
                return;
            }
            let conversation = await ConversationRepository_1.conversationRepository.findDirectConversation(userId, recipientId);
            if (!conversation) {
                conversation = await ConversationRepository_1.conversationRepository.create({
                    type: shared_1.ConversationType.DIRECT,
                    participants: [{ userId }, { userId: recipientId }],
                });
            }
            res.status(200).json((0, response_1.successResponse)({
                conversation: conversation.toJSON(),
                roomId: (0, utils_1.getConversationRoomId)(conversation),
            }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * GET /api/v1/conversations/:id/messages
 * Retrieve chronological message history for a specific conversation.
 */
router.get('/:id/messages', (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user.sub;
            const conversationId = req.params.id;
            const { limit, before, since } = req.query;
            // Authorize
            const conversation = await ConversationRepository_1.conversationRepository.findById(conversationId);
            if (!conversation) {
                throw new errors_1.NotFoundError('Conversation not found');
            }
            const isParticipant = conversation.participants.some((p) => p.userId.toString() === userId);
            if (!isParticipant) {
                throw new errors_1.UnauthorizedError('Unauthorized: You are not a participant of this conversation');
            }
            const query = { conversationId };
            if (before || since) {
                query.createdAt = {};
                if (before)
                    query.createdAt.$lt = new Date(before);
                if (since)
                    query.createdAt.$gt = new Date(since);
            }
            const messages = await MessageRepository_1.messageRepository.model
                .find(query)
                .sort({ createdAt: 1 })
                .limit(limit ? parseInt(limit, 10) : 50)
                .exec();
            res.status(200).json((0, response_1.successResponse)({ messages: messages.map((m) => m.toJSON()) }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * POST /api/v1/conversations/:id/read
 * Mark all messages in a conversation as read by the user.
 */
router.post('/:id/read', (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user.sub;
            const conversationId = req.params.id;
            // Authorize
            const conversation = await ConversationRepository_1.conversationRepository.findById(conversationId);
            if (!conversation) {
                throw new errors_1.NotFoundError('Conversation not found');
            }
            const isParticipant = conversation.participants.some((p) => p.userId.toString() === userId);
            if (!isParticipant) {
                throw new errors_1.UnauthorizedError('Unauthorized: You are not a participant of this conversation');
            }
            const now = new Date();
            const { modifiedCount } = await MessageRepository_1.messageRepository.markAllInConversationAsRead(conversationId, userId);
            await ConversationRepository_1.conversationRepository.updateParticipantReadTimestamp(conversationId, userId, now);
            res.status(200).json((0, response_1.successResponse)({
                success: true,
                conversationId,
                readAt: now.toISOString(),
                modifiedCount,
            }));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=conversations.js.map