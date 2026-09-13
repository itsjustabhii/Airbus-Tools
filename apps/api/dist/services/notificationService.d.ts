export declare class NotificationService {
    private unreadCacheKey;
    /**
     * Get unread notification count. Checks Redis cache first; if miss, queries MongoDB and caches with TTL.
     */
    getUnreadCount(userId: string): Promise<number>;
    /**
     * Invalidate unread count cache for a user.
     */
    invalidateUnreadCountCache(userId: string): Promise<void>;
    /**
     * List notifications with pagination and optional isRead filter.
     */
    listNotifications(userId: string, page?: number, limit?: number, isRead?: boolean): Promise<import("../database").PaginatedResult<import("../database").INotificationDocument>>;
    /**
     * Mark single notification as read.
     */
    markAsRead(id: string, userId: string): Promise<import("../database").INotificationDocument | null>;
    /**
     * Mark all notifications as read for a user.
     */
    markAllAsRead(userId: string): Promise<{
        modifiedCount: number;
    }>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notificationService.d.ts.map