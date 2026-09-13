import { logger } from '../core/logger';
import { notificationRepository } from '../database/repositories/NotificationRepository';
import { bullMQConnection } from '../jobs/redis';

// Simple in-memory Redis client or fallback using ioredis/bullmq connection if available
let redisClient: any = null;

async function getRedis() {
  if (redisClient) return redisClient;
  if (process.env.NODE_ENV === 'test') return null;

  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(bullMQConnection as any);
    redisClient.on('error', (err: any) => {
      logger.warn({ err }, 'NotificationService Redis cache error (falling back to Mongo)');
    });
    return redisClient;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Redis for notification cache');
    return null;
  }
}

export class NotificationService {
  private unreadCacheKey(userId: string): string {
    return `unread_notifications_count:${userId}`;
  }

  /**
   * Get unread notification count. Checks Redis cache first; if miss, queries MongoDB and caches with TTL.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const redis = await getRedis();
    const cacheKey = this.unreadCacheKey(userId);

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          return parseInt(cached, 10);
        }
      } catch (err) {
        logger.warn({ err, userId }, 'Redis get error for unread count, querying DB');
      }
    }

    // Durable source of truth: MongoDB
    const count = await notificationRepository.countUnread(userId);

    if (redis) {
      try {
        // Cache count for 60 seconds (ephemeral)
        await redis.set(cacheKey, count.toString(), 'EX', 60);
      } catch (err) {
        logger.warn({ err, userId }, 'Redis set error for unread count');
      }
    }

    return count;
  }

  /**
   * Invalidate unread count cache for a user.
   */
  async invalidateUnreadCountCache(userId: string): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      try {
        await redis.del(this.unreadCacheKey(userId));
      } catch (err) {
        logger.warn({ err, userId }, 'Redis del error on unread count cache');
      }
    }
  }

  /**
   * List notifications with pagination and optional isRead filter.
   */
  async listNotifications(userId: string, page = 1, limit = 20, isRead?: boolean) {
    return notificationRepository.findByUser(userId, isRead, {
      page,
      limit,
    });
  }

  /**
   * Mark single notification as read.
   */
  async markAsRead(id: string, userId: string) {
    const notification = await notificationRepository.markAsRead(id, userId);
    if (notification) {
      await this.invalidateUnreadCountCache(userId);
    }
    return notification;
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string) {
    const result = await notificationRepository.markAllAsRead(userId);
    await this.invalidateUnreadCountCache(userId);
    return result;
  }
}

export const notificationService = new NotificationService();
