export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    jti: string;
    iat?: number;
    exp?: number;
}
export declare function signToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>): string;
export declare function verifyToken(token: string): JwtPayload;
/**
 * Returns the number of seconds until the token expires.
 * Returns 0 if the token has already expired or has no exp claim.
 */
export declare function tokenRemainingTtl(payload: JwtPayload): number;
//# sourceMappingURL=jwt.d.ts.map