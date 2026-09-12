/**
 * Shared Redis connection for BullMQ queues and workers.
 *
 * BullMQ requires ioredis-compatible clients. The `redis` npm package (v4+) is
 * NOT ioredis-compatible, so BullMQ ships its own IORedis dependency and
 * provides a `ConnectionOptions` interface that accepts a plain object of
 * ioredis connection parameters.
 *
 * This module parses `REDIS_URL` (if present) into those options and exports
 * a single shared connection configuration for all queues and workers.
 */
import { ConnectionOptions } from 'bullmq';

import { config } from '../config/env';
import { logger } from '../core/logger';

function parseRedisUrl(url: string): ConnectionOptions {
  try {
    const parsed = new URL(url);
    const opts: ConnectionOptions & { password?: string; db?: number } = {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    };
    if (parsed.password) {
      opts.password = decodeURIComponent(parsed.password);
    }
    const dbPath = parsed.pathname?.replace('/', '');
    if (dbPath && !isNaN(Number(dbPath))) {
      opts.db = parseInt(dbPath, 10);
    }
    return opts;
  } catch {
    logger.warn({ url }, 'Failed to parse REDIS_URL; falling back to localhost defaults');
    return { host: '127.0.0.1', port: 6379 };
  }
}

/**
 * BullMQ connection options derived from `REDIS_URL`.
 * Falls back to localhost:6379 if not configured.
 *
 * `enableOfflineQueue: false` — don't buffer commands when Redis is down;
 *   fail fast instead of accumulating a backlog.
 * `maxRetriesPerRequest: 0`   — don't retry individual commands on failure
 *   (BullMQ's own job-level retry policy takes care of that).
 * `lazyConnect: true`         — don't connect until the first command is
 *   issued; prevents connection noise during tests / cold-starts.
 */
const baseOpts = config.REDIS_URL
  ? parseRedisUrl(config.REDIS_URL)
  : { host: '127.0.0.1', port: 6379 };

export const bullMQConnection: ConnectionOptions = {
  ...baseOpts,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  lazyConnect: true,
} as ConnectionOptions;

if (config.NODE_ENV !== 'test') {
  logger.info(
    {
      host: (baseOpts as { host?: string }).host ?? 'localhost',
      port: (baseOpts as { port?: number }).port ?? 6379,
    },
    '🔗 BullMQ Redis connection configured',
  );
}
