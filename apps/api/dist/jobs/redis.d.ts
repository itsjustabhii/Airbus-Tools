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
import type { ConnectionOptions } from 'bullmq';
export declare const bullMQConnection: ConnectionOptions;
//# sourceMappingURL=redis.d.ts.map