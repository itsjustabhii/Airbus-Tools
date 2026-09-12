import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { type Server } from 'socket.io';

import { config } from '../config/env';
import { logger } from '../core/logger';

type RedisClientType = ReturnType<typeof createClient>;

let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;

/**
 * Initializes and configures the Redis adapter for Socket.io if REDIS_URL is present.
 * If not present or if connection fails, falls back gracefully to standard in-memory adapter.
 */
export async function setupRedisAdapter(io: Server): Promise<void> {
  const redisUrl = config.REDIS_URL;

  if (!redisUrl) {
    logger.info('🔌 REDIS_URL not configured. Using in-memory Socket.io adapter.');
    return;
  }

  try {
    logger.info({ redisUrl }, '🔌 Connecting to Redis for Socket.io adapter...');

    pubClient = createClient({ url: redisUrl });
    subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.error({ err }, 'Socket.io Redis PubClient Error'));
    subClient.on('error', (err) => logger.error({ err }, 'Socket.io Redis SubClient Error'));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('🚀 Socket.io Redis adapter initialized successfully.');
  } catch (err) {
    logger.error({ err }, '❌ Failed to initialize Socket.io Redis adapter. Falling back to in-memory adapter.');
    
    // Clean up any partially initialized clients
    try {
      if (pubClient) await pubClient.disconnect();
      if (subClient) await subClient.disconnect();
    } catch (cleanupErr) {
      logger.error({ err: cleanupErr }, 'Error cleaning up partial Redis connections');
    }
    
    pubClient = null;
    subClient = null;
  }
}

/**
 * Cleanly disconnects Redis clients if they were initialized.
 */
export async function closeRedisAdapter(): Promise<void> {
  try {
    if (pubClient) {
      await pubClient.disconnect();
      logger.info('Disconnected Redis PubClient');
    }
    if (subClient) {
      await subClient.disconnect();
      logger.info('Disconnected Redis SubClient');
    }
  } catch (err) {
    logger.error({ err }, 'Error closing Redis adapter connections');
  } finally {
    pubClient = null;
    subClient = null;
  }
}
