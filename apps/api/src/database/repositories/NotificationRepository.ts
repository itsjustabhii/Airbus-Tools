import type { FilterQuery } from 'mongoose';

import { NotificationModel, type INotificationDocument } from '../models/Notification';

import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';

export class NotificationRepository extends BaseRepository<INotificationDocument> {
  constructor() {
    super(NotificationModel);
  }

  public async findByUser(
    userId: string,
    isRead?: boolean,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<INotificationDocument>> {
    const filter: FilterQuery<INotificationDocument> = { userId };
    if (isRead !== undefined) {
      filter.isRead = isRead;
    }
    return this.findPaginated(filter, { sort: { createdAt: -1 }, ...options });
  }

  public async countUnread(userId: string): Promise<number> {
    return this.count({ userId, isRead: false });
  }

  public async markAsRead(id: string, userId: string): Promise<INotificationDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, userId },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true },
      )
      .exec();
  }

  public async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.model
      .updateMany(
        { userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } },
      )
      .exec();

    return { modifiedCount: result.modifiedCount };
  }
}

export const notificationRepository = new NotificationRepository();
