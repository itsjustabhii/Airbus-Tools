import jwt from 'jsonwebtoken';

import { config } from '../config/env';

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: (config.JWT_EXPIRY || '15m') as jwt.SignOptions['expiresIn'] & string,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}
