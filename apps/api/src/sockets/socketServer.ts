import { type Server as HttpServer } from 'http';

import { ConversationType, MessageType } from '@airbus-tools/shared';
import { Server } from 'socket.io';

import { logger } from '../core/logger';
import { conversationRepository } from '../database/repositories/ConversationRepository';
import { messageRepository } from '../database/repositories/MessageRepository';

import {
  socketAuthMiddleware,
  sendMessageSchema,
  authorizeUserForConversation,
  type AuthenticatedSocket,
} from './middleware';
import { setupRedisAdapter } from './redis';
import { getConversationRoomId } from './utils';

// Global Socket.io server instance
let ioInstance: Server | null = null;

/**
 * Initializes the Socket.io server, applies authentication middleware, and registers event handlers.
 * Also configures the Redis adapter if a REDIS_URL environment variable is present.
 */
export async function initSocketServer(httpServer: HttpServer): Promise<Server> {
  if (ioInstance) {
    logger.warn('Socket.io server already initialized. Returning existing instance.');
    return ioInstance;
  }

  // Create Socket.io server with CORS configured to match Express
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // We can support open CORS or bind to specific configured origin
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Apply Redis adapter for multi-instance scalability
  await setupRedisAdapter(io);

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) {
      logger.error('Socket connection passed middleware but user is missing');
      socket.disconnect(true);
      return;
    }

    const userId = user.sub;
    logger.info({ userId, socketId: socket.id }, '🔌 Real-time client connected');

    // 1. Join user's personal room for direct notification targetability
    void socket.join(userId);

    // 2. Handle join_conversation
    socket.on('join_conversation', (payload: { conversationId: string }, callback?: (res: Record<string, unknown>) => void) => {
      void (async () => {
        try {
          const { conversationId } = payload;
          if (!conversationId) {
            throw new Error('conversationId is required');
          }

          // Authorize user is a participant
          const isAuthorized = await authorizeUserForConversation(userId, conversationId);
          if (!isAuthorized) {
            throw new Error('Unauthorized: You are not a participant of this conversation');
          }

          const conversation = await conversationRepository.findById(conversationId);
          if (!conversation) {
            throw new Error('Conversation not found');
          }

          const roomId = getConversationRoomId(conversation);
          void socket.join(roomId);
          logger.info({ userId, roomId, conversationId }, '👤 Joined conversation room');

          const successRes = { success: true, roomId, conversationId };
          if (callback) callback(successRes);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: errMsg, userId }, 'Error in join_conversation');
          if (callback) callback({ success: false, error: errMsg });
        }
      })();
    });

    // 3. Handle join_direct_conversation (creation/retrieval by recipient ID)
    socket.on('join_direct_conversation', (payload: { recipientId: string }, callback?: (res: Record<string, unknown>) => void) => {
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
          let conversation = await conversationRepository.findDirectConversation(userId, recipientId);
          if (!conversation) {
            conversation = await conversationRepository.create({
              type: ConversationType.DIRECT,
              participants: [{ userId }, { userId: recipientId }],
            });
            logger.info({ userId, recipientId, conversationId: conversation.id }, '🆕 Created new direct conversation');
          }

          const roomId = getConversationRoomId(conversation);
          void socket.join(roomId);

          // Join both participants if the recipient is online (they can be notified via personal room)
          socket.to(recipientId).emit('conversation_created', {
            conversation: conversation.toJSON(),
            roomId,
          });

          const successRes = { success: true, roomId, conversation: conversation.toJSON() };
          if (callback) callback(successRes);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: errMsg, userId }, 'Error in join_direct_conversation');
          if (callback) callback({ success: false, error: errMsg });
        }
      })();
    });

    // 4. Handle send_message (with strict Message Lifecycle)
    socket.on('send_message', (payload: unknown, callback?: (res: Record<string, unknown>) => void) => {
      void (async () => {
        try {
          // Step 1: Authenticate (guaranteed by socket.user check above)
          
          // Step 2: Validate message payload
          const validationResult = sendMessageSchema.safeParse(payload);
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
          const isAuthorized = await authorizeUserForConversation(userId, conversationId);
          if (!isAuthorized) {
            throw new Error('Unauthorized: You cannot post to this conversation');
          }

          const conversation = await conversationRepository.findById(conversationId);
          if (!conversation) {
            throw new Error('Conversation not found');
          }

          // Step 4: Persist message in MongoDB
          const message = await messageRepository.create({
            conversationId,
            senderId: userId,
            type: type as MessageType,
            content,
            attachments,
            isReadBy: [userId], // Sender has read it
          });

          // Update last message metadata in conversation
          const snippet = type === MessageType.TEXT ? content.substring(0, 300) : `[${type}]`;
          await conversationRepository.updateLastMessage(conversationId, snippet, message.createdAt);

          // Step 5: Broadcast (Strictly AFTER persistence!)
          const roomId = getConversationRoomId(conversation);
          
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
            }
          });

          const successRes = { success: true, message: message.toJSON() };
          if (callback) callback(successRes);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: errMsg, userId }, 'Error in send_message');
          if (callback) callback?.({ success: false, error: errMsg });
        }
      })();
    });

    // 5. Handle mark_as_read (read state and receipts)
    socket.on('mark_as_read', (payload: { conversationId: string }, callback?: (res: Record<string, unknown>) => void) => {
      void (async () => {
        try {
          const { conversationId } = payload;
          if (!conversationId) {
            throw new Error('conversationId is required');
          }

          // Authorize user
          const isAuthorized = await authorizeUserForConversation(userId, conversationId);
          if (!isAuthorized) {
            throw new Error('Unauthorized: You are not a participant of this conversation');
          }

          const conversation = await conversationRepository.findById(conversationId);
          if (!conversation) {
            throw new Error('Conversation not found');
          }

          const now = new Date();

          // 1. Mark all messages in conversation as read by this user
          const { modifiedCount } = await messageRepository.markAllInConversationAsRead(conversationId, userId);

          // 2. Update participant's read timestamp
          await conversationRepository.updateParticipantReadTimestamp(conversationId, userId, now);

          // 3. Broadcast read status to the room
          const roomId = getConversationRoomId(conversation);
          socket.to(roomId).emit('messages_read', {
            conversationId,
            userId,
            readAt: now.toISOString(),
            modifiedCount,
          });

          const successRes = { success: true, conversationId, userId, readAt: now.toISOString(), modifiedCount };
          if (callback) callback(successRes);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: errMsg, userId }, 'Error in mark_as_read');
          if (callback) callback({ success: false, error: errMsg });
        }
      })();
    });

    // 6. Handle get_conversations
    socket.on('get_conversations', (_payload: unknown, callback?: (res: Record<string, unknown>) => void) => {
      void (async () => {
        try {
          const result = await conversationRepository.findUserConversations(userId, { limit: 100 });
          const conversationsJson = await Promise.all(
            result.items.map(async (conv) => {
              const convJson = conv.toJSON();
              const unreadCount = await messageRepository.countUnreadInConversation(conv.id, userId);
              return {
                ...convJson,
                unreadCount,
              };
            }),
          );

          if (callback) callback({ success: true, conversations: conversationsJson });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: errMsg, userId }, 'Error in get_conversations');
          if (callback) callback?.({ success: false, error: errMsg });
        }
      })();
    });

    // 7. Handle get_message_history (paginated/missed messages retrieval)
    socket.on(
      'get_message_history',
      (
        payload: { conversationId: string; limit?: number; before?: string; since?: string },
        callback?: (res: Record<string, unknown>) => void,
      ) => {
        void (async () => {
          try {
            const { conversationId, limit = 50, before, since } = payload;
            if (!conversationId) {
              throw new Error('conversationId is required');
            }

            // Authorize user
            const isAuthorized = await authorizeUserForConversation(userId, conversationId);
            if (!isAuthorized) {
              throw new Error('Unauthorized: You are not a participant of this conversation');
            }

            // Build query criteria
            const query: Record<string, unknown> = { conversationId };

            if (before || since) {
              const dateCriteria: Record<string, Date> = {};
              if (before) {
                dateCriteria.$lt = new Date(before);
              }
              if (since) {
                dateCriteria.$gt = new Date(since);
              }
              query.createdAt = dateCriteria;
            }

            // Fetch messages sorted chronologically (oldest to newest)
            const messages = await messageRepository.model
              .find(query)
              .sort({ createdAt: 1 })
              .limit(limit)
              .exec();

            const messagesJson = messages.map((m) => m.toJSON());

            if (callback) callback({ success: true, messages: messagesJson });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            logger.error({ err: errMsg, userId }, 'Error in get_message_history');
            if (callback) callback?.({ success: false, error: errMsg });
          }
        })();
      },
    );

    // 8. Handle rejoin_conversations (Reconnect behavior)
    socket.on('rejoin_conversations', (payload: { conversationIds: string[] }, callback?: (res: Record<string, unknown>) => void) => {
      void (async () => {
        try {
          const { conversationIds } = payload;
          if (!Array.isArray(conversationIds)) {
            throw new Error('conversationIds must be an array');
          }

          const rejoinedRooms: string[] = [];

          for (const conversationId of conversationIds) {
            const isAuthorized = await authorizeUserForConversation(userId, conversationId);
            if (isAuthorized) {
              const conversation = await conversationRepository.findById(conversationId);
              if (conversation) {
                const roomId = getConversationRoomId(conversation);
                void socket.join(roomId);
                rejoinedRooms.push(conversationId);
              }
            }
          }

          logger.info({ userId, rejoinedCount: rejoinedRooms.length }, '🔁 Rejoined conversations on reconnect');
          if (callback) callback({ success: true, rejoinedConversationIds: rejoinedRooms });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: errMsg, userId }, 'Error in rejoin_conversations');
          if (callback) callback?.({ success: false, error: errMsg });
        }
      })();
    });

    // 9. Handle get_unread_count
    socket.on('get_unread_count', (payload?: { conversationId?: string }, callback?: (res: Record<string, unknown>) => void) => {
      void (async () => {
        try {
          const targetConversationId = payload?.conversationId;

          if (targetConversationId) {
            // Authorize and fetch count for a single conversation
            const isAuthorized = await authorizeUserForConversation(userId, targetConversationId);
            if (!isAuthorized) {
              throw new Error('Unauthorized');
            }
            const unreadCount = await messageRepository.countUnreadInConversation(targetConversationId, userId);
            if (callback) callback({ success: true, conversationId: targetConversationId, unreadCount });
            return;
          }

          // Fetch unread count across ALL user conversations
          const userConversations = await conversationRepository.findUserConversations(userId, { limit: 100 });
          let totalUnread = 0;
          const detailMap: Record<string, number> = {};

          for (const conv of userConversations.items) {
            const count = await messageRepository.countUnreadInConversation(conv.id, userId);
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
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: errMsg, userId }, 'Error in get_unread_count');
          if (callback) callback?.({ success: false, error: errMsg });
        }
      })();
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info({ userId, socketId: socket.id, reason }, '🔌 Real-time client disconnected');
    });
  });

  ioInstance = io;
  return io;
}

/**
 * Retrieves the active Socket.io server instance.
 */
export function getSocketServer(): Server {
  if (!ioInstance) {
    throw new Error('Socket.io server has not been initialized. Call initSocketServer(httpServer) first.');
  }
  return ioInstance;
}

/**
 * Returns the active Socket.io server instance, or `null` if it has not been
 * initialized yet. Safe to call from background worker processes.
 */
export function getIO(): Server | null {
  return ioInstance;
}

/**
 * Resets the Socket.io server singleton instance.
 * Primarily used in test suites to allow re-initialization on dynamic ports.
 */
export function resetSocketServer(): void {
  ioInstance = null;
}
