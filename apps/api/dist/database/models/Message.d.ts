import { MessageType, type MessageAttachment } from '@airbus-tools/shared';
import { Schema, type Document, type Types } from 'mongoose';
export interface IMessageDocument extends Document {
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    type: MessageType;
    content: string;
    attachments: MessageAttachment[];
    isReadBy: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Message Schema definition
 *
 * Index Rationale:
 * 1. { conversationId: 1, createdAt: 1 } (Compound)
 *    - Query Pattern: Chat message stream retrieval with pagination (infinite scroll / chronological conversation history).
 *    - Rationale: High query frequency; avoids collection scans and in-memory sorting for chat views.
 * 2. { senderId: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: User message activity tracking and moderation review of recent outbound messages.
 *    - Rationale: Fast user activity lookup.
 */
export declare const MessageSchema: Schema<IMessageDocument, import("mongoose").Model<IMessageDocument, any, any, any, Document<unknown, any, IMessageDocument, any, {}> & IMessageDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IMessageDocument, Document<unknown, {}, import("mongoose").FlatRecord<IMessageDocument>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<IMessageDocument> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const MessageModel: import("mongoose").Model<IMessageDocument, {}, {}, {}, Document<unknown, {}, IMessageDocument, {}, {}> & IMessageDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Message.d.ts.map