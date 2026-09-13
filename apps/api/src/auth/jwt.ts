import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../config/env';

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  role: string;
  jti: string;   // unique token ID — used for revocation
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>): string {
  return jwt.sign(
    { ...payload, jti: uuidv4() },
    config.JWT_SECRET,
    { expiresIn: (config.JWT_EXPIRY || '15m') as jwt.SignOptions['expiresIn'] & string },
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

/**
 * Returns the number of seconds until the token expires.
 * Returns 0 if the token has already expired or has no exp claim.
 */
export function tokenRemainingTtl(payload: JwtPayload): number {
  if (!payload.exp) return 0;
  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
}
