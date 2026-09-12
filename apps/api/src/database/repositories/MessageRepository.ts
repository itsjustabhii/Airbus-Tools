import { MessageModel, type IMessageDocument } from '../models/Message';

import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';

export class MessageRepository extends BaseRepository<IMessageDocument> {
  constructor() {
    super(MessageModel);
  }

  public async findByConversation(
    conversationId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IMessageDocument>> {
    return this.findPaginated(
      { conversationId },
      { sort: { createdAt: 1 }, ...options },
    );
  }

  public async findRecentMessages(
    conversationId: string,
    limit: number = 50,
  ): Promise<IMessageDocument[]> {
    return this.model
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  public async markAsRead(messageIds: string[], userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.model
      .updateMany(
        { _id: { $in: messageIds }, isReadBy: { $ne: userId } },
        { $addToSet: { isReadBy: userId } },
      )
      .exec();

    return { modifiedCount: result.modifiedCount };
  }

  public async markAllInConversationAsRead(
    conversationId: string,
    userId: string,
  ): Promise<{ modifiedCount: number }> {
    const result = await this.model
      .updateMany(
        { conversationId, isReadBy: { $ne: userId } },
        { $addToSet: { isReadBy: userId } },
      )
      .exec();

    return { modifiedCount: result.modifiedCount };
  }

  public async countUnreadInConversation(conversationId: string, userId: string): Promise<number> {
    return this.count({
      conversationId,
      senderId: { $ne: userId },
      isReadBy: { $ne: userId },
    });
  }
}

export const messageRepository = new MessageRepository();
