"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const logger_1 = require("../core/logger");
const NotificationRepository_1 = require("../database/repositories/NotificationRepository");
const redis_1 = require("../jobs/redis");
// Simple in-memory Redis client or fallback using ioredis/bullmq connection if available
let redisClient = null;
async function getRedis() {
    if (redisClient)
        return redisClient;
    if (process.env.NODE_ENV === 'test')
        return null;
    try {
        const Redis = (await Promise.resolve().then(() => __importStar(require('ioredis')))).default;
        redisClient = new Redis(redis_1.bullMQConnection);
        redisClient.on('error', (err) => {
            logger_1.logger.warn({ err }, 'NotificationService Redis cache error (falling back to Mongo)');
        });
        return redisClient;
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Failed to initialize Redis for notification cache');
        return null;
    }
}
class NotificationService {
    unreadCacheKey(userId) {
        return `unread_notifications_count:${userId}`;
    }
    /**
     * Get unread notification count. Checks Redis cache first; if miss, queries MongoDB and caches with TTL.
     */
    async getUnreadCount(userId) {
        const redis = await getRedis();
        const cacheKey = this.unreadCacheKey(userId);
        if (redis) {
            try {
                const cached = await redis.get(cacheKey);
                if (cached !== null) {
                    return parseInt(cached, 10);
                }
            }
            catch (err) {
                logger_1.logger.warn({ err, userId }, 'Redis get error for unread count, querying DB');
            }
        }
        // Durable source of truth: MongoDB
        const count = await NotificationRepository_1.notificationRepository.countUnread(userId);
        if (redis) {
            try {
                // Cache count for 60 seconds (ephemeral)
                await redis.set(cacheKey, count.toString(), 'EX', 60);
            }
            catch (err) {
                logger_1.logger.warn({ err, userId }, 'Redis set error for unread count');
            }
        }
        return count;
    }
    /**
     * Invalidate unread count cache for a user.
     */
    async invalidateUnreadCountCache(userId) {
        const redis = await getRedis();
        if (redis) {
            try {
                await redis.del(this.unreadCacheKey(userId));
            }
            catch (err) {
                logger_1.logger.warn({ err, userId }, 'Redis del error on unread count cache');
            }
        }
    }
    /**
     * List notifications with pagination and optional isRead filter.
     */
    async listNotifications(userId, page = 1, limit = 20, isRead) {
        const skip = (page - 1) * limit;
        return NotificationRepository_1.notificationRepository.findByUser(userId, isRead, {
            skip,
            limit,
        });
    }
    /**
     * Mark single notification as read.
     */
    async markAsRead(id, userId) {
        const notification = await NotificationRepository_1.notificationRepository.markAsRead(id, userId);
        if (notification) {
            await this.invalidateUnreadCountCache(userId);
        }
        return notification;
    }
    /**
     * Mark all notifications as read for a user.
     */
    async markAllAsRead(userId) {
        const result = await NotificationRepository_1.notificationRepository.markAllAsRead(userId);
        await this.invalidateUnreadCountCache(userId);
        return result;
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
//# sourceMappingURL=notificationService.js.map