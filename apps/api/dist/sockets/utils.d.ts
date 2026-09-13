import { ConversationType } from '@airbus-tools/shared';
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
export declare function generateRoomId(userId1: string, userId2: string): string;
/**
 * Resolves the deterministic room ID for a conversation.
 * If direct conversation with 2 participants, returns deterministic user hash roomId.
 * Otherwise, returns conversation's database _id as string.
 */
export declare function getConversationRoomId(conversation: {
    id?: string;
    _id?: unknown;
    type: ConversationType;
    participants: Array<{
        userId: unknown;
    }>;
}): string;
//# sourceMappingURL=utils.d.ts.map