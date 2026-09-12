import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';
import { ConversationType } from '@airbus-tools/shared';

import { UnauthorizedError, NotFoundError } from '../core/errors';
import { successResponse } from '../core/response';
import { conversationRepository } from '../database/repositories/ConversationRepository';
import { messageRepository } from '../database/repositories/MessageRepository';
import { authenticate } from '../middlewares/authenticate';
import { getConversationRoomId } from '../sockets/utils';

const router: Router = createRouter();

// Require authentication for all conversation endpoints
router.use(authenticate);

/**
 * GET /api/v1/conversations
 * Retrieve all conversations for the authenticated user, enriched with unread counts.
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const userId = req.user!.sub;
      const result = await conversationRepository.findUserConversations(userId, { limit: 100 });

      const conversations = await Promise.all(
        result.items.map(async (conv) => {
          const convJson = conv.toJSON();
          const unreadCount = await messageRepository.countUnreadInConversation(conv.id, userId);
          return {
            ...convJson,
            unreadCount,
            roomId: getConversationRoomId(conv),
          };
        }),
      );

      res.status(200).json(successResponse({ conversations }));
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * POST /api/v1/conversations
 * Find or create a direct conversation with another user.
 */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const userId = req.user!.sub;
      const { recipientId } = req.body as { recipientId?: string };

      if (!recipientId) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'recipientId is required' } });
        return;
      }

      if (recipientId === userId) {
        res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Cannot start a conversation with yourself' } });
        return;
      }

      let conversation = await conversationRepository.findDirectConversation(userId, recipientId);
      if (!conversation) {
        conversation = await conversationRepository.create({
          type: ConversationType.DIRECT,
          participants: [{ userId }, { userId: recipientId }],
        });
      }

      res.status(200).json(
        successResponse({
          conversation: conversation.toJSON(),
          roomId: getConversationRoomId(conversation),
        }),
      );
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * GET /api/v1/conversations/:id/messages
 * Retrieve chronological message history for a specific conversation.
 */
router.get('/:id/messages', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const userId = req.user!.sub;
      const conversationId = req.params.id;
      const { limit, before, since } = req.query as { limit?: string; before?: string; since?: string };

      // Authorize
      const conversation = await conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      const isParticipant = conversation.participants.some((p) => p.userId.toString() === userId);
      if (!isParticipant) {
        throw new UnauthorizedError('Unauthorized: You are not a participant of this conversation');
      }

      const query: any = { conversationId };
      if (before || since) {
        query.createdAt = {};
        if (before) query.createdAt.$lt = new Date(before);
        if (since) query.createdAt.$gt = new Date(since);
      }

      const messages = await messageRepository.model
        .find(query)
        .sort({ createdAt: 1 })
        .limit(limit ? parseInt(limit, 10) : 50)
        .exec();

      res.status(200).json(successResponse({ messages: messages.map((m) => m.toJSON()) }));
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * POST /api/v1/conversations/:id/read
 * Mark all messages in a conversation as read by the user.
 */
router.post('/:id/read', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const userId = req.user!.sub;
      const conversationId = req.params.id;

      // Authorize
      const conversation = await conversationRepository.findById(conversationId);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      const isParticipant = conversation.participants.some((p) => p.userId.toString() === userId);
      if (!isParticipant) {
        throw new UnauthorizedError('Unauthorized: You are not a participant of this conversation');
      }

      const now = new Date();
      const { modifiedCount } = await messageRepository.markAllInConversationAsRead(conversationId, userId);
      await conversationRepository.updateParticipantReadTimestamp(conversationId, userId, now);

      res.status(200).json(
        successResponse({
          success: true,
          conversationId,
          readAt: now.toISOString(),
          modifiedCount,
        }),
      );
    } catch (err) {
      next(err);
    }
  })();
});

export { router as conversationsRouter };
