"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullMQConnection = void 0;
const env_1 = require("../config/env");
const logger_1 = require("../core/logger");
function parseRedisUrl(url) {
    try {
        const parsed = new URL(url);
        const opts = {
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
    }
    catch {
        logger_1.logger.warn({ url }, 'Failed to parse REDIS_URL; falling back to localhost defaults');
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
const baseOpts = env_1.config.REDIS_URL
    ? parseRedisUrl(env_1.config.REDIS_URL)
    : { host: '127.0.0.1', port: 6379 };
exports.bullMQConnection = {
    ...baseOpts,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    lazyConnect: true,
};
if (env_1.config.NODE_ENV !== 'test') {
    logger_1.logger.info({
        host: baseOpts.host ?? 'localhost',
        port: baseOpts.port ?? 6379,
    }, '🔗 BullMQ Redis connection configured');
}
//# sourceMappingURL=redis.js.map