import { MessageType, type MessageAttachment } from '@airbus-tools/shared';
import { Schema, model, type Document, type Types } from 'mongoose';

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

const MessageAttachmentSchema = new Schema<MessageAttachment>(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true, min: [0, 'File size cannot be negative'] },
    mimeType: { type: String, required: true },
  },
  { _id: false },
);

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
export const MessageSchema = new Schema<IMessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      required: true,
      default: MessageType.TEXT,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [10000, 'Message cannot exceed 10000 characters'],
    },
    attachments: {
      type: [MessageAttachmentSchema],
      default: [],
    },
    isReadBy: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const result = ret as Record<string, unknown>;
        result.id = (result._id as { toString(): string }).toString();
        if (result.conversationId) {
          result.conversationId = (result.conversationId as { toString(): string }).toString();
        }
        if (result.senderId) {
          result.senderId = (result.senderId as { toString(): string }).toString();
        }
        if (Array.isArray(result.isReadBy)) {
          result.isReadBy = (result.isReadBy as Array<{ toString(): string }>).map((id) => id?.toString());
        }
        delete result._id;
        delete result.__v;
        return result;
      },
    },
  },
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });

export const MessageModel = model<IMessageDocument>('Message', MessageSchema);
