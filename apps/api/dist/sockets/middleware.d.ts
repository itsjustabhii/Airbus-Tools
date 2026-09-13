import { MessageType } from '@airbus-tools/shared';
import { type Socket } from 'socket.io';
import { z } from 'zod';
import { type JwtPayload } from '../auth/jwt';
export interface AuthenticatedSocket extends Socket {
    user?: JwtPayload;
}
/**
 * Utility to parse cookies manually from cookie header.
 */
export declare function parseCookies(cookieHeader: string | undefined): Record<string, string>;
/**
 * Middleware to authenticate Socket.io connections.
 * Attempts to extract JWT from handshake auth token, query params, or cookie header.
 */
export declare function socketAuthMiddleware(socket: AuthenticatedSocket, next: (err?: Error) => void): void;
/**
 * Zod validation schema for message sending payload.
 */
export declare const sendMessageSchema: z.ZodObject<{
    conversationId: z.ZodString;
    content: z.ZodString;
    type: z.ZodDefault<z.ZodNativeEnum<typeof MessageType>>;
    attachments: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        fileName: z.ZodString;
        fileSize: z.ZodNumber;
        mimeType: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
    }, {
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    type: MessageType;
    conversationId: string;
    content: string;
    attachments: {
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
    }[];
}, {
    conversationId: string;
    content: string;
    type?: MessageType | undefined;
    attachments?: {
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
    }[] | undefined;
}>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
/**
 * Helper to authorize that a user is a participant of a conversation.
 */
export declare function authorizeUserForConversation(userId: string, conversationId: string): Promise<boolean>;
//# sourceMappingURL=middleware.d.ts.map