import { type IConversationDocument } from '../models/Conversation';
import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';
export declare class ConversationRepository extends BaseRepository<IConversationDocument> {
    constructor();
    findUserConversations(userId: string, options?: PaginationOptions): Promise<PaginatedResult<IConversationDocument>>;
    findByOrder(orderId: string): Promise<IConversationDocument | null>;
    findByProductAndUsers(productId: string, participantUserIds: string[]): Promise<IConversationDocument | null>;
    updateLastMessage(conversationId: string, snippet: string, timestamp?: Date): Promise<IConversationDocument | null>;
    updateParticipantReadTimestamp(conversationId: string, userId: string, readAt?: Date): Promise<IConversationDocument | null>;
    findDirectConversation(userA: string, userB: string): Promise<IConversationDocument | null>;
}
export declare const conversationRepository: ConversationRepository;
//# sourceMappingURL=ConversationRepository.d.ts.map