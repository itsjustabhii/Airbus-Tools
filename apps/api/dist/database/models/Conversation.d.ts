import { ConversationType } from '@airbus-tools/shared';
import { Schema, type Document, type Types } from 'mongoose';
export interface IConversationDocument extends Document {
    participants: Array<{
        userId: Types.ObjectId;
        lastReadAt?: Date;
    }>;
    type: ConversationType;
    productId?: Types.ObjectId;
    orderId?: Types.ObjectId;
    lastMessageAt?: Date;
    lastMessageSnippet?: string;
    title?: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Conversation Schema definition
 *
 * Index Rationale:
 * 1. { 'participants.userId': 1, lastMessageAt: -1 } (Compound / Multikey)
 *    - Query Pattern: User inbox listing — finding all active threads for a specific user ordered by latest activity.
 *    - Rationale: Most frequent inbox view; multikey index on participant user IDs efficiently sorts conversations without in-memory sort.
 * 2. { orderId: 1 } (Sparse)
 *    - Query Pattern: Contextual messaging linking buyer and seller directly to an order transaction thread.
 *    - Rationale: Quick direct retrieval of the transaction chat thread.
 * 3. { productId: 1 } (Sparse)
 *    - Query Pattern: Contextual messaging regarding a specific catalog product or RFQ inquiry.
 *    - Rationale: Direct lookup of pre-sale product inquiries.
 */
export declare const ConversationSchema: Schema<IConversationDocument, import("mongoose").Model<IConversationDocument, any, any, any, Document<unknown, any, IConversationDocument, any, {}> & IConversationDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IConversationDocument, Document<unknown, {}, import("mongoose").FlatRecord<IConversationDocument>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<IConversationDocument> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const ConversationModel: import("mongoose").Model<IConversationDocument, {}, {}, {}, Document<unknown, {}, IConversationDocument, {}, {}> & IConversationDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Conversation.d.ts.map