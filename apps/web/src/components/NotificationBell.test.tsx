import { NotificationType } from '@airbus-tools/shared';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { notificationsApi } from '../api/notificationsApi';

import { NotificationBell } from './NotificationBell';

vi.mock('../api/notificationsApi', () => ({
  notificationsApi: {
    getUnreadCount: vi.fn(),
    listNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

const mockNotifications = [
  {
    id: 'n-1',
    userId: 'u-1',
    type: NotificationType.ORDER_UPDATE,
    title: 'Order Accepted',
    message: 'Your order was accepted',
    isRead: false,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
  },
  {
    id: 'n-2',
    userId: 'u-1',
    type: NotificationType.PAYMENT_UPDATE,
    title: 'Payment Received',
    message: 'Payment of $500 received',
    isRead: true,
    createdAt: new Date('2025-01-01T09:00:00Z'),
    updatedAt: new Date('2025-01-01T09:00:00Z'),
  },
];

describe('NotificationBell component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bell button and loads unread count badge', async () => {
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(2);
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      notifications: mockNotifications as any,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    render(<NotificationBell pollInterval={0} />);

    expect(screen.getByTestId('notification-bell-btn')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('unread-count-badge')).toHaveTextContent('2');
    });
  });

  it('opens dropdown and displays notification items on click', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(1);
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      notifications: mockNotifications as any,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    render(<NotificationBell pollInterval={0} />);

    await user.click(screen.getByTestId('notification-bell-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('notifications-dropdown')).toBeInTheDocument();
      expect(screen.getByText('Order Accepted')).toBeInTheDocument();
      expect(screen.getByText('Payment Received')).toBeInTheDocument();
    });
  });

  it('marks a single notification as read', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(1);
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      notifications: mockNotifications as any,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    vi.mocked(notificationsApi.markAsRead).mockResolvedValue({
      ...mockNotifications[0],
      isRead: true,
    } as any);

    render(<NotificationBell pollInterval={0} />);

    await user.click(screen.getByTestId('notification-bell-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('mark-read-btn-n-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('mark-read-btn-n-1'));

    await waitFor(() => {
      expect(notificationsApi.markAsRead).toHaveBeenCalledWith('n-1');
    });
  });

  it('marks all notifications as read', async () => {
    const user = userEvent.setup();
    vi.mocked(notificationsApi.getUnreadCount).mockResolvedValue(1);
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      notifications: mockNotifications as any,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    vi.mocked(notificationsApi.markAllAsRead).mockResolvedValue({ modifiedCount: 1 });

    render(<NotificationBell pollInterval={0} />);

    await user.click(screen.getByTestId('notification-bell-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('mark-all-read-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('mark-all-read-btn'));

    await waitFor(() => {
      expect(notificationsApi.markAllAsRead).toHaveBeenCalled();
    });
  });
});
