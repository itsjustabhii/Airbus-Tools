"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const errors_1 = require("../core/errors");
const response_1 = require("../core/response");
const authenticate_1 = require("../middlewares/authenticate");
const notificationService_1 = require("../services/notificationService");
const notifications_schemas_1 = require("./notifications.schemas");
const router = (0, express_1.Router)();
exports.notificationsRouter = router;
// All notification endpoints require authentication
router.use(authenticate_1.authenticate);
/**
 * GET /api/notifications
 * List user notifications with pagination and optional read status filter.
 */
router.get('/', (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user.sub;
            const query = notifications_schemas_1.listNotificationsQuerySchema.parse(req.query);
            const paginatedResult = await notificationService_1.notificationService.listNotifications(userId, query.page, query.limit, query.isRead);
            const notifications = paginatedResult.items.map((n) => n.toJSON());
            res.status(200).json((0, response_1.successResponse)({ notifications }, {
                page: query.page,
                limit: query.limit,
                total: paginatedResult.total,
                totalPages: Math.ceil(paginatedResult.total / query.limit) || 1,
            }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications for authenticated user.
 */
router.get('/unread-count', (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user.sub;
            const unreadCount = await notificationService_1.notificationService.getUnreadCount(userId);
            res.status(200).json((0, response_1.successResponse)({
                unreadCount,
            }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * PATCH /api/notifications/mark-all-read
 * Mark all unread notifications for current user as read.
 */
router.patch('/mark-all-read', (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user.sub;
            const result = await notificationService_1.notificationService.markAllAsRead(userId);
            res.status(200).json((0, response_1.successResponse)({
                message: 'All notifications marked as read',
                modifiedCount: result.modifiedCount,
            }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', (req, res, next) => {
    void (async () => {
        try {
            const userId = req.user.sub;
            const { id } = notifications_schemas_1.notificationIdParamSchema.parse(req.params);
            const updated = await notificationService_1.notificationService.markAsRead(id, userId);
            if (!updated) {
                throw new errors_1.NotFoundError('Notification not found');
            }
            res.status(200).json((0, response_1.successResponse)({
                notification: updated.toJSON(),
            }));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=notifications.js.map