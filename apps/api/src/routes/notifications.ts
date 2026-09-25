import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';

import { NotFoundError } from '../core/errors';
import { successResponse } from '../core/response';
import { authenticate } from '../middlewares/authenticate';
import { notificationService } from '../services/notificationService';

import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.schemas';

const router: Router = createRouter();

// All notification endpoints require authentication
router.use(authenticate);

/**
 * GET /api/notifications
 * List user notifications with pagination and optional read status filter.
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const userId = req.user!.sub;
      const query = listNotificationsQuerySchema.parse(req.query);

      const paginatedResult = await notificationService.listNotifications(
        userId,
        query.page,
        query.limit,
        query.isRead,
      );

      const notifications = paginatedResult.items.map((n) => n.toJSON());

      res.status(200).json(
        successResponse(
          { notifications },
          {
            page: query.page,
            limit: query.limit,
            total: paginatedResult.total,
            totalPages: Math.ceil(paginatedResult.total / query.limit) || 1,
          },
        ),
      );
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications for authenticated user.
 */
router.get('/unread-count', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const userId = req.user!.sub;
      const unreadCount = await notificationService.getUnreadCount(userId);

      res.status(200).json(
        successResponse({
          unreadCount,
        }),
      );
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all unread notifications for current user as read.
 */
router.patch('/mark-all-read', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const userId = req.user!.sub;
      const result = await notificationService.markAllAsRead(userId);

      res.status(200).json(
        successResponse({
          message: 'All notifications marked as read',
          modifiedCount: result.modifiedCount,
        }),
      );
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const userId = req.user!.sub;
      const { id } = notificationIdParamSchema.parse(req.params);

      const updated = await notificationService.markAsRead(id, userId);
      if (!updated) {
        throw new NotFoundError('Notification not found');
      }

      res.status(200).json(
        successResponse({
          notification: updated.toJSON(),
        }),
      );
    } catch (err) {
      next(err);
    }
  })();
});

export { router as notificationsRouter };
