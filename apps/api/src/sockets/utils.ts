import { createHash } from 'crypto';

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
export function generateRoomId(userId1: string, userId2: string): string {
  if (!userId1 || !userId2) {
    throw new Error('Both user IDs must be provided to generate a room ID');
  }
  const sorted = [String(userId1), String(userId2)].sort();
  const rawString = `${sorted[0]}:${sorted[1]}`;
  return createHash('sha256').update(rawString).digest('hex');
}

/**
 * Resolves the deterministic room ID for a conversation.
 * If direct conversation with 2 participants, returns deterministic user hash roomId.
 * Otherwise, returns conversation's database _id as string.
 */
export function getConversationRoomId(conversation: {
  id?: string;
  _id?: unknown;
  type: ConversationType;
  participants: Array<{ userId: unknown }>;
}): string {
  if (conversation.type === ConversationType.DIRECT && conversation.participants.length === 2) {
    return generateRoomId(
      String(conversation.participants[0].userId),
      String(conversation.participants[1].userId),
    );
  }
  const idStr = conversation.id || (conversation._id ? String(conversation._id) : undefined);
  if (!idStr) {
    throw new Error('Conversation does not have a valid ID');
  }
  return idStr;
}
