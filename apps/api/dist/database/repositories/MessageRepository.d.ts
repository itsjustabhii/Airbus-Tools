import { type IMessageDocument } from '../models/Message';
import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';
export declare class MessageRepository extends BaseRepository<IMessageDocument> {
    constructor();
    findByConversation(conversationId: string, options?: PaginationOptions): Promise<PaginatedResult<IMessageDocument>>;
    findRecentMessages(conversationId: string, limit?: number): Promise<IMessageDocument[]>;
    markAsRead(messageIds: string[], userId: string): Promise<{
        modifiedCount: number;
    }>;
    markAllInConversationAsRead(conversationId: string, userId: string): Promise<{
        modifiedCount: number;
    }>;
    countUnreadInConversation(conversationId: string, userId: string): Promise<number>;
}
export declare const messageRepository: MessageRepository;
//# sourceMappingURL=MessageRepository.d.ts.map