import { NotificationType, type Notification } from '@airbus-tools/shared';
import { useState, useEffect, useRef, useCallback } from 'react';

import { notificationsApi } from '../api/notificationsApi';

export interface NotificationBellProps {
  /** Optional polling interval in ms (defaults to 30000ms, 0 to disable) */
  pollInterval?: number;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.ORDER_UPDATE:
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </span>
      );
    case NotificationType.PAYMENT_UPDATE:
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
    case NotificationType.MESSAGE_RECEIVED:
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </span>
      );
    default:
      return (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
  }
}

export function NotificationBell({ pollInterval = 30000 }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Ignored if user not logged in or network error
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: { limit: number; isRead?: boolean } = { limit: 20 };
      if (filter === 'UNREAD') {
        params.isRead = false;
      }
      const res = await notificationsApi.listNotifications(params);
      setNotifications(res.notifications);
    } catch {
      // Handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  // Initial load + interval polling
  useEffect(() => {
    void fetchUnreadCount();

    if (pollInterval > 0) {
      const interval = setInterval(() => {
        void fetchUnreadCount();
        if (isOpen) {
          void fetchNotifications();
        }
      }, pollInterval);
      return () => {
        clearInterval(interval);
      };
    }
    return undefined;
  }, [fetchUnreadCount, fetchNotifications, isOpen, pollInterval]);

  // Fetch notifications whenever opened or filter changed
  useEffect(() => {
    if (isOpen) {
      void fetchNotifications();
      void fetchUnreadCount();
    }
  }, [isOpen, filter, fetchNotifications, fetchUnreadCount]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Error handling
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Error handling
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        data-testid="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-full p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span
            data-testid="unread-count-badge"
            className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div
          data-testid="notifications-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden border border-gray-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 bg-gray-50/70">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                data-testid="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-gray-100 bg-white px-4 py-2 text-xs">
            <button
              type="button"
              data-testid="filter-all-btn"
              onClick={() => setFilter('ALL')}
              className={`mr-4 font-medium pb-1 border-b-2 transition-colors ${
                filter === 'ALL'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              All
            </button>
            <button
              type="button"
              data-testid="filter-unread-btn"
              onClick={() => setFilter('UNREAD')}
              className={`font-medium pb-1 border-b-2 transition-colors ${
                filter === 'UNREAD'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Unread only
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100" data-testid="notifications-list">
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-sm text-gray-500">
                <svg className="animate-spin h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500" data-testid="empty-notifications">
                No notifications found
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  data-testid={`notification-item-${notif.id}`}
                  className={`flex items-start p-4 hover:bg-gray-50 transition-colors ${
                    !notif.isRead ? 'bg-blue-50/40' : 'bg-white'
                  }`}
                >
                  <div className="flex-shrink-0 mr-3">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-semibold ${!notif.isRead ? 'text-blue-900' : 'text-gray-900'}`}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <button
                          type="button"
                          data-testid={`mark-read-btn-${notif.id}`}
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          title="Mark as read"
                          className="text-xs text-blue-600 hover:text-blue-800 ml-2 font-medium"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(notif.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
