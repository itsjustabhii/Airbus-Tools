import { type Server } from 'socket.io';
/**
 * Initializes and configures the Redis adapter for Socket.io if REDIS_URL is present.
 * If not present or if connection fails, falls back gracefully to standard in-memory adapter.
 */
export declare function setupRedisAdapter(io: Server): Promise<void>;
/**
 * Cleanly disconnects Redis clients if they were initialized.
 */
export declare function closeRedisAdapter(): Promise<void>;
//# sourceMappingURL=redis.d.ts.map