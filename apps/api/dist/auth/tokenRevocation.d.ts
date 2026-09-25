/**
 * Add a JWT ID to the revocation list.
 * @param jti  The JWT `jti` claim value.
 * @param ttlSeconds  Remaining lifetime in seconds (should match token expiry).
 */
export declare function revokeToken(jti: string, ttlSeconds: number): Promise<void>;
/**
 * Returns true if the given JWT ID has been revoked.
 */
export declare function isTokenRevoked(jti: string): Promise<boolean>;
export declare function closeRevocationClient(): Promise<void>;
//# sourceMappingURL=tokenRevocation.d.ts.map