import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { NotificationType, UserRole, UserStatus } from '@airbus-tools/shared';

import { createApp } from '../app';
import { signToken } from '../auth/jwt';
import { AUTH_COOKIE_NAME } from '../auth/service';
import { NotificationModel } from '../database/models/Notification';
import { UserModel } from '../database/models/User';
import { setupTestDB, teardownTestDB, clearTestDB } from '../database/test-utils';

const app = createApp();
const request = supertest(app);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createTestUser(email = 'user@example.com') {
  const hash = await bcrypt.hash('Password123!', 10);
  return UserModel.create({
    email,
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    company: 'Airbus test',
    passwordHash: hash,
    role: UserRole.AIRLINE,
    status: UserStatus.ACTIVE,
  });
}

function authCookie(token: string): string {
  return `${AUTH_COOKIE_NAME}=${token}`;
}

// ── DB lifecycle ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

describe('Notifications API Routes', () => {
  describe('GET /api/notifications', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request.get('/api/notifications');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns user notifications with pagination metadata', async () => {
      const user = await createTestUser();
      const token = signToken({ sub: user._id.toString(), email: user.email, role: user.role });

      await NotificationModel.create([
        {
          userId: user._id,
          type: NotificationType.ORDER_UPDATE,
          title: 'Order Accepted',
          message: 'Your order has been accepted',
          isRead: false,
        },
        {
          userId: user._id,
          type: NotificationType.PAYMENT_UPDATE,
          title: 'Payment Successful',
          message: 'Payment of $1,000 received',
          isRead: true,
        },
      ]);

      const res = await request
        .get('/api/notifications')
        .set('Cookie', authCookie(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('filters by isRead status', async () => {
      const user = await createTestUser();
      const token = signToken({ sub: user._id.toString(), email: user.email, role: user.role });

      await NotificationModel.create([
        {
          userId: user._id,
          type: NotificationType.ORDER_UPDATE,
          title: 'Unread 1',
          message: 'Message 1',
          isRead: false,
        },
        {
          userId: user._id,
          type: NotificationType.PAYMENT_UPDATE,
          title: 'Read 1',
          message: 'Message 2',
          isRead: true,
        },
      ]);

      const res = await request
        .get('/api/notifications?isRead=false')
        .set('Cookie', authCookie(token));

      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0].title).toBe('Unread 1');
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('returns correct unread count', async () => {
      const user = await createTestUser();
      const token = signToken({ sub: user._id.toString(), email: user.email, role: user.role });

      await NotificationModel.create([
        {
          userId: user._id,
          type: NotificationType.ORDER_UPDATE,
          title: 'Unread 1',
          message: 'Msg 1',
          isRead: false,
        },
        {
          userId: user._id,
          type: NotificationType.ORDER_UPDATE,
          title: 'Unread 2',
          message: 'Msg 2',
          isRead: false,
        },
        {
          userId: user._id,
          type: NotificationType.PAYMENT_UPDATE,
          title: 'Read 1',
          message: 'Msg 3',
          isRead: true,
        },
      ]);

      const res = await request
        .get('/api/notifications/unread-count')
        .set('Cookie', authCookie(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unreadCount).toBe(2);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('marks a single notification as read', async () => {
      const user = await createTestUser();
      const token = signToken({ sub: user._id.toString(), email: user.email, role: user.role });

      const notif = await NotificationModel.create({
        userId: user._id,
        type: NotificationType.ORDER_UPDATE,
        title: 'Pending notification',
        message: 'Review order',
        isRead: false,
      });

      const res = await request
        .patch(`/api/notifications/${notif._id}/read`)
        .set('Cookie', authCookie(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notification.isRead).toBe(true);

      const dbNotif = await NotificationModel.findById(notif._id);
      expect(dbNotif?.isRead).toBe(true);
      expect(dbNotif?.readAt).toBeDefined();
    });

    it('returns 404 if notification belongs to another user or does not exist', async () => {
      const user1 = await createTestUser('user1@example.com');
      const user2 = await createTestUser('user2@example.com');
      const token1 = signToken({ sub: user1._id.toString(), email: user1.email, role: user1.role });

      const notif2 = await NotificationModel.create({
        userId: user2._id,
        type: NotificationType.ORDER_UPDATE,
        title: 'User 2 notification',
        message: 'Secret',
        isRead: false,
      });

      const res = await request
        .patch(`/api/notifications/${notif2._id}/read`)
        .set('Cookie', authCookie(token1));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/notifications/mark-all-read', () => {
    it('marks all user unread notifications as read', async () => {
      const user = await createTestUser();
      const token = signToken({ sub: user._id.toString(), email: user.email, role: user.role });

      await NotificationModel.create([
        {
          userId: user._id,
          type: NotificationType.ORDER_UPDATE,
          title: 'Notif 1',
          message: 'Msg 1',
          isRead: false,
        },
        {
          userId: user._id,
          type: NotificationType.PAYMENT_UPDATE,
          title: 'Notif 2',
          message: 'Msg 2',
          isRead: false,
        },
      ]);

      const res = await request
        .patch('/api/notifications/mark-all-read')
        .set('Cookie', authCookie(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.modifiedCount).toBe(2);

      const unreadCount = await NotificationModel.countDocuments({ userId: user._id, isRead: false });
      expect(unreadCount).toBe(0);
    });
  });
});
