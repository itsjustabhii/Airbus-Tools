import { ConversationType } from '@airbus-tools/shared';

import { ConversationModel, type IConversationDocument } from '../models/Conversation';

import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';

export class ConversationRepository extends BaseRepository<IConversationDocument> {
  constructor() {
    super(ConversationModel);
  }

  public async findUserConversations(
    userId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IConversationDocument>> {
    return this.findPaginated(
      { 'participants.userId': userId },
      { sort: { lastMessageAt: -1 }, ...options },
    );
  }

  public async findByOrder(orderId: string): Promise<IConversationDocument | null> {
    return this.findOne({ orderId });
  }

  public async findByProductAndUsers(
    productId: string,
    participantUserIds: string[],
  ): Promise<IConversationDocument | null> {
    return this.findOne({
      productId,
      'participants.userId': { $all: participantUserIds },
    });
  }

  public async updateLastMessage(
    conversationId: string,
    snippet: string,
    timestamp: Date = new Date(),
  ): Promise<IConversationDocument | null> {
    return this.updateById(conversationId, {
      lastMessageSnippet: snippet,
      lastMessageAt: timestamp,
    });
  }

  public async updateParticipantReadTimestamp(
    conversationId: string,
    userId: string,
    readAt: Date = new Date(),
  ): Promise<IConversationDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: conversationId, 'participants.userId': userId },
        { $set: { 'participants.$.lastReadAt': readAt } },
        { new: true },
      )
      .exec();
  }

  public async findDirectConversation(userA: string, userB: string): Promise<IConversationDocument | null> {
    return this.findOne({
      type: ConversationType.DIRECT,
      'participants.userId': { $all: [userA, userB] },
    });
  }
}

export const conversationRepository = new ConversationRepository();
