import type { Notification } from '@airbus-tools/shared';

import { apiClient } from './profileApi';

export interface ListNotificationsParams {
  page?: number | undefined;
  limit?: number | undefined;
  isRead?: boolean | undefined;
}

export interface NotificationsListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const notificationsApi = {
  /**
   * GET /api/notifications
   */
  listNotifications: async (params?: ListNotificationsParams): Promise<{
    notifications: Notification[];
    meta: NotificationsListMeta;
  }> => {
    const res = await apiClient.get<{
      success: boolean;
      data: { notifications: Notification[] };
      meta: NotificationsListMeta;
    }>('/notifications', { params });
    return {
      notifications: res.data.data.notifications,
      meta: res.data.meta,
    };
  },

  /**
   * GET /api/notifications/unread-count
   */
  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get<{
      success: boolean;
      data: { unreadCount: number };
    }>('/notifications/unread-count');
    return res.data.data.unreadCount;
  },

  /**
   * PATCH /api/notifications/:id/read
   */
  markAsRead: async (id: string): Promise<Notification> => {
    const res = await apiClient.patch<{
      success: boolean;
      data: { notification: Notification };
    }>(`/notifications/${id}/read`);
    return res.data.data.notification;
  },

  /**
   * PATCH /api/notifications/mark-all-read
   */
  markAllAsRead: async (): Promise<{ modifiedCount: number }> => {
    const res = await apiClient.patch<{
      success: boolean;
      data: { message: string; modifiedCount: number };
    }>('/notifications/mark-all-read');
    return res.data.data;
  },
};
