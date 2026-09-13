/**
 * JWT token revocation list backed by Redis.
 *
 * On logout or password change, the current token's `jti` is added to a Redis
 * set with a TTL matching the remaining token lifetime.  The authenticate
 * middleware checks this list before accepting a token.
 *
 * Graceful degradation: if Redis is unavailable the revocation list is skipped
 * and a warning is logged.  This is an acceptable trade-off for availability —
 * revocation misses are bounded by the JWT_EXPIRY window (default 15 minutes).
 */
import { createClient } from 'redis';

import { config } from '../config/env';
import { logger } from '../core/logger';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectionAttempted = false;

async function getRedisClient(): Promise<RedisClient | null> {
  if (connectionAttempted) return client;
  if (config.NODE_ENV === 'test' || !config.REDIS_URL) return null;

  connectionAttempted = true;
  try {
    client = createClient({ url: config.REDIS_URL });
    client.on('error', (err) => {
      logger.warn({ err }, 'Token revocation Redis client error');
    });
    await client.connect();
    logger.info('Token revocation Redis client connected');
    return client;
  } catch (err) {
    logger.warn({ err }, 'Failed to connect token revocation Redis client — revocation will not be enforced');
    client = null;
    return null;
  }
}

const REVOCATION_PREFIX = 'revoked_jti:';

/**
 * Add a JWT ID to the revocation list.
 * @param jti  The JWT `jti` claim value.
 * @param ttlSeconds  Remaining lifetime in seconds (should match token expiry).
 */
export async function revokeToken(jti: string, ttlSeconds: number): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  try {
    await redis.set(`${REVOCATION_PREFIX}${jti}`, '1', { EX: ttlSeconds });
  } catch (err) {
    logger.warn({ err, jti }, 'Failed to write token revocation entry');
  }
}

/**
 * Returns true if the given JWT ID has been revoked.
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false; // degrade gracefully
  try {
    const value = await redis.get(`${REVOCATION_PREFIX}${jti}`);
    return value !== null;
  } catch (err) {
    logger.warn({ err, jti }, 'Failed to check token revocation — allowing token');
    return false;
  }
}

export async function closeRevocationClient(): Promise<void> {
  if (client) {
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
    client = null;
    connectionAttempted = false;
  }
}
