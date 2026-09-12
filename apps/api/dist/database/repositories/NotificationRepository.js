"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRepository = exports.NotificationRepository = void 0;
const Notification_1 = require("../models/Notification");
const BaseRepository_1 = require("./BaseRepository");
class NotificationRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super(Notification_1.NotificationModel);
    }
    async findByUser(userId, isRead, options) {
        const filter = { userId };
        if (isRead !== undefined) {
            filter.isRead = isRead;
        }
        return this.findPaginated(filter, { sort: { createdAt: -1 }, ...options });
    }
    async countUnread(userId) {
        return this.count({ userId, isRead: false });
    }
    async markAsRead(id, userId) {
        return this.model
            .findOneAndUpdate({ _id: id, userId }, { $set: { isRead: true, readAt: new Date() } }, { new: true })
            .exec();
    }
    async markAllAsRead(userId) {
        const result = await this.model
            .updateMany({ userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } })
            .exec();
        return { modifiedCount: result.modifiedCount };
    }
}
exports.NotificationRepository = NotificationRepository;
exports.notificationRepository = new NotificationRepository();
//# sourceMappingURL=NotificationRepository.js.map