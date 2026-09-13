"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = initSocketServer;
exports.getSocketServer = getSocketServer;
exports.getIO = getIO;
exports.resetSocketServer = resetSocketServer;
const shared_1 = require("@airbus-tools/shared");
const socket_io_1 = require("socket.io");
const queues_1 = require("../jobs/queues");
const logger_1 = require("../core/logger");
const ConversationRepository_1 = require("../database/repositories/ConversationRepository");
const MessageRepository_1 = require("../database/repositories/MessageRepository");
const middleware_1 = require("./middleware");
const redis_1 = require("./redis");
const utils_1 = require("./utils");
// Global Socket.io server instance
let ioInstance = null;
/**
 * Initializes the Socket.io server, applies authentication middleware, and registers event handlers.
 * Also configures the Redis adapter if a REDIS_URL environment variable is present.
 */
async function initSocketServer(httpServer) {
    if (ioInstance) {
        logger_1.logger.warn('Socket.io server already initialized. Returning existing instance.');
        return ioInstance;
    }
    // Create Socket.io server with CORS configured to match Express
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*', // We can support open CORS or bind to specific configured origin
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });
    // Apply Redis adapter for multi-instance scalability
    await (0, redis_1.setupRedisAdapter)(io);
    // Apply authentication middleware
    io.use(middleware_1.socketAuthMiddleware);
    io.on('connection', (socket) => {
        const user = socket.user;
        if (!user) {
            logger_1.logger.error('Socket connection passed middleware but user is missing');
            socket.disconnect(true);
            return;
        }
        const userId = user.sub;
        logger_1.logger.info({ userId, socketId: socket.id }, '🔌 Real-time client connected');
        // 1. Join user's personal room for direct notification targetability
        void socket.join(userId);
        // 2. Handle join_conversation
        socket.on('join_conversation', (payload, callback) => {
            void (async () => {
                try {
                    const { conversationId } = payload;
                    if (!conversationId) {
                        throw new Error('conversationId is required');
                    }
                    // Authorize user is a participant
                    const isAuthorized = await (0, middleware_1.authorizeUserForConversation)(userId, conversationId);
                    if (!isAuthorized) {
                        throw new Error('Unauthorized: You are not a participant of this conversation');
                    }
                    const conversation = await ConversationRepository_1.conversationRepository.findById(conversationId);
                    if (!conversation) {
                        throw new Error('Conversation not found');
                    }
                    const roomId = (0, utils_1.getConversationRoomId)(conversation);
                    void socket.join(roomId);
                    logger_1.logger.info({ userId, roomId, conversationId }, '👤 Joined conversation room');
                    const successRes = { success: true, roomId, conversationId };
                    if (callback)
                        callback(successRes);
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    logger_1.logger.error({ err: errMsg, userId }, 'Error in join_conversation');
                    if (callback)
                        callback({ success: false, error: errMsg });
                }
            })();
        });
        // 3. Handle join_direct_conversation (creation/retrieval by recipient ID)
        socket.on('join_direct_conversation', (payload, callback) => {
            void (async () => {
                try {
                    const { recipientId } = payload;
                    if (!recipientId) {
                        throw new Error('recipientId is required');
                    }
                    if (recipientId === userId) {
                        throw new Error('Cannot start a direct conversation with yourself');
                    }
                    // Find or create direct conversation
                    let conversation = await ConversationRepository_1.conversationRepository.findDirectConversation(userId, recipientId);
                    if (!conversation) {
                        conversation = await ConversationRepository_1.conversationRepository.create({
                            type: shared_1.ConversationType.DIRECT,
                            participants: [{ userId }, { userId: recipientId }],
                        });
                        logger_1.logger.info({ userId, recipientId, conversationId: conversation.id }, '🆕 Created new direct conversation');
                    }
                    const roomId = (0, utils_1.getConversationRoomId)(conversation);
                    void socket.join(roomId);
                    // Join both participants if the recipient is online (they can be notified via personal room)
                    socket.to(recipientId).emit('conversation_created', {
                        conversation: conversation.toJSON(),
                        roomId,
                    });
                    const successRes = { success: true, roomId, conversation: conversation.toJSON() };
                    if (callback)
                        callback(successRes);
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    logger_1.logger.error({ err: errMsg, userId }, 'Error in join_direct_conversation');
                    if (callback)
                        callback({ success: false, error: errMsg });
                }
            })();
        });
        // 4. Handle send_message (with strict Message Lifecycle)
        socket.on('send_message', (payload, callback) => {
            void (async () => {
                try {
                    // Step 1: Authenticate (guaranteed by socket.user check above)
                    // Step 2: Validate message payload
                    const validationResult = middleware_1.sendMessageSchema.safeParse(payload);
                    if (!validationResult.success) {
                        const errorDetails = validationResult.error.format();
                        if (callback) {
                            callback({
                                success: false,
                                error: 'Validation failed',
                                details: errorDetails,
                            });
                        }
                        return;
                    }
                    const { conversationId, content, type, attachments } = validationResult.data;
                    // Step 3: Authorize
                    const isAuthorized = await (0, middleware_1.authorizeUserForConversation)(userId, conversationId);
                    if (!isAuthorized) {
                        throw new Error('Unauthorized: You cannot post to this conversation');
                    }
                    const conversation = await ConversationRepository_1.conversationRepository.findById(conversationId);
                    if (!conversation) {
                        throw new Error('Conversation not found');
                    }
                    // Step 4: Persist message in MongoDB
                    const message = await MessageRepository_1.messageRepository.create({
                        conversationId,
                        senderId: userId,
                        type: type,
                        content,
                        attachments,
                        isReadBy: [userId], // Sender has read it
                    });
                    // Update last message metadata in conversation
                    const snippet = type === shared_1.MessageType.TEXT ? content.substring(0, 300) : `[${type}]`;
                    await ConversationRepository_1.conversationRepository.updateLastMessage(conversationId, snippet, message.createdAt);
                    // Step 5: Broadcast (Strictly AFTER persistence!)
                    const roomId = (0, utils_1.getConversationRoomId)(conversation);
                    // Emit to everyone in the room (including sender if they have multiple tabs/sessions, excluding current socket)
                    socket.to(roomId).emit('message_received', message.toJSON());
                    // Also notify other participants who might not have joined the room yet via their personal rooms
                    conversation.participants.forEach((p) => {
                        const participantId = p.userId.toString();
                        if (participantId !== userId) {
                            io.to(participantId).emit('new_message_notification', {
                                message: message.toJSON(),
                                conversationId,
                            });
                            // Asynchronously enqueue in-app durable notification for recipient
                            void (0, queues_1.enqueueNotification)({
                                name: 'create-notification',
                                jobId: (0, queues_1.newJobId)(),
                                userId: participantId,
                                type: shared_1.NotificationType.MESSAGE_RECEIVED,
                                title: 'New Message',
                                message: snippet.length > 100 ? `${snippet.substring(0, 97)}...` : snippet,
                                referenceEntityType: 'MESSAGE',
                                referenceEntityId: message._id.toString(),
                                pushViaSocket: true,
                            });
                        }
                    });
                    const successRes = { success: true, message: message.toJSON() };
                    if (callback)
                        callback(successRes);
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    logger_1.logger.error({ err: errMsg, userId }, 'Error in send_message');
                    if (callback)
                        callback?.({ success: false, error: errMsg });
                }
            })();
        });
        // 5. Handle mark_as_read (read state and receipts)
        socket.on('mark_as_read', (payload, callback) => {
            void (async () => {
                try {
                    const { conversationId } = payload;
                    if (!conversationId) {
                        throw new Error('conversationId is required');
                    }
                    // Authorize user
                    const isAuthorized = await (0, middleware_1.authorizeUserForConversation)(userId, conversationId);
                    if (!isAuthorized) {
                        throw new Error('Unauthorized: You are not a participant of this conversation');
                    }
                    const conversation = await ConversationRepository_1.conversationRepository.findById(conversationId);
                    if (!conversation) {
                        throw new Error('Conversation not found');
                    }
                    const now = new Date();
                    // 1. Mark all messages in conversation as read by this user
                    const { modifiedCount } = await MessageRepository_1.messageRepository.markAllInConversationAsRead(conversationId, userId);
                    // 2. Update participant's read timestamp
                    await ConversationRepository_1.conversationRepository.updateParticipantReadTimestamp(conversationId, userId, now);
                    // 3. Broadcast read status to the room
                    const roomId = (0, utils_1.getConversationRoomId)(conversation);
                    socket.to(roomId).emit('messages_read', {
                        conversationId,
                        userId,
                        readAt: now.toISOString(),
                        modifiedCount,
                    });
                    const successRes = { success: true, conversationId, userId, readAt: now.toISOString(), modifiedCount };
                    if (callback)
                        callback(successRes);
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    logger_1.logger.error({ err: errMsg, userId }, 'Error in mark_as_read');
                    if (callback)
                        callback({ success: false, error: errMsg });
                }
            })();
        });
        // 6. Handle get_conversations
        socket.on('get_conversations', (_payload, callback) => {
            void (async () => {
                try {
                    const result = await ConversationRepository_1.conversationRepository.findUserConversations(userId, { limit: 100 });
                    const conversationsJson = await Promise.all(result.items.map(async (conv) => {
                        const convJson = conv.toJSON();
                        const unreadCount = await MessageRepository_1.messageRepository.countUnreadInConversation(conv.id, userId);
                        return {
                            ...convJson,
                            unreadCount,
                        };
                    }));
                    if (callback)
                        callback({ success: true, conversations: conversationsJson });
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    logger_1.logger.error({ err: errMsg, userId }, 'Error in get_conversations');
                    if (callback)
                        callback?.({ success: false, error: errMsg });
                }
            })();
        });
        // 7. Handle get_message_history (paginated/missed messages retrieval)
        socket.on('get_message_history', (payload, callback) => {
            void (async () => {
                try {
                    const { conversationId, limit = 50, before, since } = payload;
                    if (!conversationId) {
                        throw new Error('conversationId is required');
                    }
                    // Authorize user
                    const isAuthorized = await (0, middleware_1.authorizeUserForConversation)(userId, conversationId);
                    if (!isAuthorized) {
                        throw new Error('Unauthorized: You are not a participant of this conversation');
                    }
                    // Build query criteria
                    const query = { conversationId };
                    if (before || since) {
                        const dateCriteria = {};
                        if (before) {
                            dateCriteria.$lt = new Date(before);
                        }
                        if (since) {
                            dateCriteria.$gt = new Date(since);
                        }
                        query.createdAt = dateCriteria;
                    }
                    // Fetch messages sorted chronologically (oldest to newest)
                    const messages = await MessageRepository_1.messageRepository.model
                        .find(query)
                        .sort({ createdAt: 1 })
                        .limit(limit)
                        .exec();
                    const messagesJson = messages.map((m) => m.toJSON());
                    if (callback)
                        callback({ success: true, messages: messagesJson });
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    logger_1.logger.error({ err: errMsg, userId }, 'Error in get_message_history');
                    if (callback)
                        callback?.({ success: false, error: errMsg });
                }
            })();
        });
        // 8. Handle rejoin_conversations (Reconnect behavior)
        socket.on('rejoin_conversations', (payload, callback) => {
            void (async () => {
                try {
                    const { conversationIds } = payload;
                    if (!Array.isArray(conversationIds)) {
                        throw new Error('conversationIds must be an array');
                    }
                    const rejoinedRooms = [];
                    for (const conversationId of conversationIds) {
                        const isAuthorized = await (0, middleware_1.authorizeUserForConversation)(userId, conversationId);
                        if (isAuthorized) {
                            const conversation = await ConversationRepository_1.conversationRepository.findById(conversationId);
                            if (conversation) {
                                const roomId = (0, utils_1.getConversationRoomId)(conversation);
                                void socket.join(roomId);
                                rejoinedRooms.push(conversationId);
                            }
                        }
                    }
                    logger_1.logger.info({ userId, rejoinedCount: rejoinedRooms.length }, '🔁 Rejoined conversations on reconnect');
                    if (callback)
                        callback({ success: true, rejoinedConversationIds: rejoinedRooms });
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    logger_1.logger.error({ err: errMsg, userId }, 'Error in rejoin_conversations');
                    if (callback)
                        callback?.({ success: false, error: errMsg });
                }
            })();
        });
        // 9. Handle get_unread_count
        socket.on('get_unread_count', (payload, callback) => {
            void (async () => {
                try {
                    const targetConversationId = payload?.conversationId;
                    if (targetConversationId) {
                        // Authorize and fetch count for a single conversation
                        const isAuthorized = await (0, middleware_1.authorizeUserForConversation)(userId, targetConversationId);
                        if (!isAuthorized) {
                            throw new Error('Unauthorized');
                        }
                        const unreadCount = await MessageRepository_1.messageRepository.countUnreadInConversation(targetConversationId, userId);
                        if (callback)
                            callback({ success: true, conversationId: targetConversationId, unreadCount });
                        return;
                    }
                    // Fetch unread count across ALL user conversations
                    const userConversations = await ConversationRepository_1.conversationRepository.findUserConversations(userId, { limit: 100 });
                    let totalUnread = 0;
                    const detailMap = {};
                    for (const conv of userConversations.items) {
                        const count = await MessageRepository_1.messageRepository.countUnreadInConversation(conv.id, userId);
                        totalUnread += count;
                        detailMap[conv.id] = count;
                    }
                    if (callback) {
                        callback({
                            success: true,
                            totalUnreadCount: totalUnread,
                            conversations: detailMap,
                        });
                    }
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : 'Unknown error';
                    logger_1.logger.error({ err: errMsg, userId }, 'Error in get_unread_count');
                    if (callback)
                        callback?.({ success: false, error: errMsg });
                }
            })();
        });
        // Handle disconnect
        socket.on('disconnect', (reason) => {
            logger_1.logger.info({ userId, socketId: socket.id, reason }, '🔌 Real-time client disconnected');
        });
    });
    ioInstance = io;
    return io;
}
/**
 * Retrieves the active Socket.io server instance.
 */
function getSocketServer() {
    if (!ioInstance) {
        throw new Error('Socket.io server has not been initialized. Call initSocketServer(httpServer) first.');
    }
    return ioInstance;
}
/**
 * Returns the active Socket.io server instance, or `null` if it has not been
 * initialized yet. Safe to call from background worker processes.
 */
function getIO() {
    return ioInstance;
}
/**
 * Resets the Socket.io server singleton instance.
 * Primarily used in test suites to allow re-initialization on dynamic ports.
 */
function resetSocketServer() {
    ioInstance = null;
}
//# sourceMappingURL=socketServer.js.map