"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeToken = revokeToken;
exports.isTokenRevoked = isTokenRevoked;
exports.closeRevocationClient = closeRevocationClient;
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
const redis_1 = require("redis");
const env_1 = require("../config/env");
const logger_1 = require("../core/logger");
let client = null;
let connectionAttempted = false;
async function getRedisClient() {
    if (connectionAttempted)
        return client;
    if (env_1.config.NODE_ENV === 'test' || !env_1.config.REDIS_URL)
        return null;
    connectionAttempted = true;
    try {
        client = (0, redis_1.createClient)({ url: env_1.config.REDIS_URL });
        client.on('error', (err) => {
            logger_1.logger.warn({ err }, 'Token revocation Redis client error');
        });
        await client.connect();
        logger_1.logger.info('Token revocation Redis client connected');
        return client;
    }
    catch (err) {
        logger_1.logger.warn({ err }, 'Failed to connect token revocation Redis client — revocation will not be enforced');
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
async function revokeToken(jti, ttlSeconds) {
    const redis = await getRedisClient();
    if (!redis)
        return;
    try {
        await redis.set(`${REVOCATION_PREFIX}${jti}`, '1', { EX: ttlSeconds });
    }
    catch (err) {
        logger_1.logger.warn({ err, jti }, 'Failed to write token revocation entry');
    }
}
/**
 * Returns true if the given JWT ID has been revoked.
 */
async function isTokenRevoked(jti) {
    const redis = await getRedisClient();
    if (!redis)
        return false; // degrade gracefully
    try {
        const value = await redis.get(`${REVOCATION_PREFIX}${jti}`);
        return value !== null;
    }
    catch (err) {
        logger_1.logger.warn({ err, jti }, 'Failed to check token revocation — allowing token');
        return false;
    }
}
async function closeRevocationClient() {
    if (client) {
        try {
            await client.disconnect();
        }
        catch {
            // ignore
        }
        client = null;
        connectionAttempted = false;
    }
}
//# sourceMappingURL=tokenRevocation.js.map