import { type INotificationDocument } from '../models/Notification';
import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';
export declare class NotificationRepository extends BaseRepository<INotificationDocument> {
    constructor();
    findByUser(userId: string, isRead?: boolean, options?: PaginationOptions): Promise<PaginatedResult<INotificationDocument>>;
    countUnread(userId: string): Promise<number>;
    markAsRead(id: string, userId: string): Promise<INotificationDocument | null>;
    markAllAsRead(userId: string): Promise<{
        modifiedCount: number;
    }>;
}
export declare const notificationRepository: NotificationRepository;
//# sourceMappingURL=NotificationRepository.d.ts.map