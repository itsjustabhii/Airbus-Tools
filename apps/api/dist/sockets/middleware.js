"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessageSchema = void 0;
exports.parseCookies = parseCookies;
exports.socketAuthMiddleware = socketAuthMiddleware;
exports.authorizeUserForConversation = authorizeUserForConversation;
const shared_1 = require("@airbus-tools/shared");
const zod_1 = require("zod");
const jwt_1 = require("../auth/jwt");
const service_1 = require("../auth/service");
const ConversationRepository_1 = require("../database/repositories/ConversationRepository");
/**
 * Utility to parse cookies manually from cookie header.
 */
function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader)
        return cookies;
    cookieHeader.split(';').forEach((item) => {
        const parts = item.split('=');
        const name = parts[0].trim();
        if (name) {
            cookies[name] = decodeURIComponent((parts[1] || '').trim());
        }
    });
    return cookies;
}
/**
 * Middleware to authenticate Socket.io connections.
 * Attempts to extract JWT from handshake auth token, query params, or cookie header.
 */
function socketAuthMiddleware(socket, next) {
    const auth = socket.handshake.auth || {};
    const query = socket.handshake.query || {};
    const cookieHeader = socket.handshake.headers.cookie;
    let token = auth.token ||
        auth.access_token ||
        query.token ||
        query.access_token;
    if (!token && cookieHeader) {
        const cookies = parseCookies(cookieHeader);
        token = cookies[service_1.AUTH_COOKIE_NAME];
    }
    if (!token) {
        return next(new Error('Authentication error: Token not provided'));
    }
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        socket.user = payload;
        next();
    }
    catch (error) {
        return next(new Error('Authentication error: Invalid or expired token'));
    }
}
/**
 * Zod validation schema for message sending payload.
 */
exports.sendMessageSchema = zod_1.z.object({
    conversationId: zod_1.z.string().min(1, 'conversationId is required'),
    content: zod_1.z.string().min(1, 'Message content cannot be empty').max(10000, 'Message cannot exceed 10000 characters'),
    type: zod_1.z.nativeEnum(shared_1.MessageType).default(shared_1.MessageType.TEXT),
    attachments: zod_1.z
        .array(zod_1.z.object({
        url: zod_1.z.string().url('Invalid attachment URL'),
        fileName: zod_1.z.string().min(1, 'fileName is required'),
        fileSize: zod_1.z.number().nonnegative('fileSize cannot be negative'),
        mimeType: zod_1.z.string().min(1, 'mimeType is required'),
    }))
        .optional()
        .default([]),
});
/**
 * Helper to authorize that a user is a participant of a conversation.
 */
async function authorizeUserForConversation(userId, conversationId) {
    if (!userId || !conversationId)
        return false;
    try {
        const conversation = await ConversationRepository_1.conversationRepository.findById(conversationId);
        if (!conversation) {
            return false;
        }
        return conversation.participants.some((p) => p.userId.toString() === userId.toString());
    }
    catch (err) {
        return false;
    }
}
//# sourceMappingURL=middleware.js.map