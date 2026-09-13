import { MessageType } from '@airbus-tools/shared';
import { type Socket } from 'socket.io';
import { z } from 'zod';

import { verifyToken, type JwtPayload } from '../auth/jwt';
import { AUTH_COOKIE_NAME } from '../auth/service';
import { conversationRepository } from '../database/repositories/ConversationRepository';

// Extend the socket interface to include the authenticated user
export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

/**
 * Utility to parse cookies manually from cookie header.
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((item) => {
    const parts = item.split('=');
    const name = parts[0]?.trim();
    if (name) {
      cookies[name] = decodeURIComponent((parts[1] ?? '').trim());
    }
  });
  return cookies;
}

/**
 * Middleware to authenticate Socket.io connections.
 * Attempts to extract JWT from handshake auth token, query params, or cookie header.
 */
export function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
  const auth = socket.handshake.auth || {};
  const cookieHeader = socket.handshake.headers.cookie;

  // Accept token only from handshake.auth or the HttpOnly cookie.
  // Query-string tokens are explicitly NOT accepted — URL parameters appear in
  // access logs, browser history, and referrer headers, which would expose tokens.
  let token: unknown =
    (auth.token as unknown) ||
    (auth.access_token as unknown);

  if (!token && cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    token = cookies[AUTH_COOKIE_NAME];
  }

  if (!token) {
    return next(new Error('Authentication error: Token not provided'));
  }

  try {
    const payload = verifyToken(token as string);
    socket.user = payload;
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid or expired token'));
  }
}

/**
 * Zod validation schema for message sending payload.
 */
export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  content: z.string().min(1, 'Message content cannot be empty').max(10000, 'Message cannot exceed 10000 characters'),
  type: z.nativeEnum(MessageType).default(MessageType.TEXT),
  attachments: z
    .array(
      z.object({
        url: z.string().url('Invalid attachment URL'),
        fileName: z.string().min(1, 'fileName is required'),
        fileSize: z.number().nonnegative('fileSize cannot be negative'),
        mimeType: z.string().min(1, 'mimeType is required'),
      }),
    )
    .optional()
    .default([]),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * Helper to authorize that a user is a participant of a conversation.
 */
export async function authorizeUserForConversation(userId: string, conversationId: string): Promise<boolean> {
  if (!userId || !conversationId) return false;
  try {
    const conversation = await conversationRepository.findById(conversationId);
    if (!conversation) {
      return false;
    }
    return conversation.participants.some((p) => p.userId.toString() === userId.toString());
  } catch (err) {
    return false;
  }
}
