"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRoomId = generateRoomId;
exports.getConversationRoomId = getConversationRoomId;
const crypto_1 = require("crypto");
const shared_1 = require("@airbus-tools/shared");
/**
 * Generates a deterministic room ID for a pair of users.
 * Guarantees that generateRoomId(A, B) === generateRoomId(B, A).
 *
 * Algorithm:
 * 1. Sort the two user IDs lexicographically.
 * 2. Join them with a colon: `${smaller}:${larger}`.
 * 3. Generate a SHA-256 hash of the joined string.
 * 4. Return the hex representation of the hash.
 */
function generateRoomId(userId1, userId2) {
    if (!userId1 || !userId2) {
        throw new Error('Both user IDs must be provided to generate a room ID');
    }
    const sorted = [String(userId1), String(userId2)].sort();
    const rawString = `${sorted[0]}:${sorted[1]}`;
    return (0, crypto_1.createHash)('sha256').update(rawString).digest('hex');
}
/**
 * Resolves the deterministic room ID for a conversation.
 * If direct conversation with 2 participants, returns deterministic user hash roomId.
 * Otherwise, returns conversation's database _id as string.
 */
function getConversationRoomId(conversation) {
    if (conversation.type === shared_1.ConversationType.DIRECT && conversation.participants.length === 2) {
        const p0 = conversation.participants[0];
        const p1 = conversation.participants[1];
        if (!p0 || !p1) {
            throw new Error('Direct conversation must have exactly two participants');
        }
        return generateRoomId(String(p0.userId), String(p1.userId));
    }
    const idStr = conversation.id || (conversation._id ? String(conversation._id) : undefined);
    if (!idStr) {
        throw new Error('Conversation does not have a valid ID');
    }
    return idStr;
}
//# sourceMappingURL=utils.js.map