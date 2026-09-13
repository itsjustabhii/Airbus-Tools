"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRedisAdapter = setupRedisAdapter;
exports.closeRedisAdapter = closeRedisAdapter;
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("redis");
const env_1 = require("../config/env");
const logger_1 = require("../core/logger");
let pubClient = null;
let subClient = null;
/**
 * Initializes and configures the Redis adapter for Socket.io if REDIS_URL is present.
 * If not present or if connection fails, falls back gracefully to standard in-memory adapter.
 */
async function setupRedisAdapter(io) {
    const redisUrl = env_1.config.REDIS_URL;
    if (!redisUrl) {
        logger_1.logger.info('🔌 REDIS_URL not configured. Using in-memory Socket.io adapter.');
        return;
    }
    try {
        logger_1.logger.info({ redisUrl }, '🔌 Connecting to Redis for Socket.io adapter...');
        pubClient = (0, redis_1.createClient)({ url: redisUrl });
        subClient = pubClient.duplicate();
        pubClient.on('error', (err) => logger_1.logger.error({ err }, 'Socket.io Redis PubClient Error'));
        subClient.on('error', (err) => logger_1.logger.error({ err }, 'Socket.io Redis SubClient Error'));
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
        logger_1.logger.info('🚀 Socket.io Redis adapter initialized successfully.');
    }
    catch (err) {
        logger_1.logger.error({ err }, '❌ Failed to initialize Socket.io Redis adapter. Falling back to in-memory adapter.');
        // Clean up any partially initialized clients
        try {
            if (pubClient)
                await pubClient.disconnect();
            if (subClient)
                await subClient.disconnect();
        }
        catch (cleanupErr) {
            logger_1.logger.error({ err: cleanupErr }, 'Error cleaning up partial Redis connections');
        }
        pubClient = null;
        subClient = null;
    }
}
/**
 * Cleanly disconnects Redis clients if they were initialized.
 */
async function closeRedisAdapter() {
    try {
        if (pubClient) {
            await pubClient.disconnect();
            logger_1.logger.info('Disconnected Redis PubClient');
        }
        if (subClient) {
            await subClient.disconnect();
            logger_1.logger.info('Disconnected Redis SubClient');
        }
    }
    catch (err) {
        logger_1.logger.error({ err }, 'Error closing Redis adapter connections');
    }
    finally {
        pubClient = null;
        subClient = null;
    }
}
//# sourceMappingURL=redis.js.map