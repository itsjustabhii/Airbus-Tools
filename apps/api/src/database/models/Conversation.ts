import { ConversationType } from '@airbus-tools/shared';
import { Schema, model, type Document, type Types } from 'mongoose';

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

const ConversationParticipantSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

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
export const ConversationSchema = new Schema<IConversationDocument>(
  {
    participants: {
      type: [ConversationParticipantSchema],
      required: [true, 'Participants are required'],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length >= 2,
        message: 'A conversation must have at least two participants',
      },
    },
    type: {
      type: String,
      enum: Object.values(ConversationType),
      required: true,
      default: ConversationType.DIRECT,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    lastMessageSnippet: {
      type: String,
      trim: true,
      maxlength: [300, 'Snippet cannot exceed 300 characters'],
      default: null,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const result = ret as Record<string, unknown>;
        result.id = (result._id as { toString(): string }).toString();
        if (result.productId) {
          result.productId = (result.productId as { toString(): string }).toString();
        }
        if (result.orderId) {
          result.orderId = (result.orderId as { toString(): string }).toString();
        }
        if (Array.isArray(result.participants)) {
          result.participants = (result.participants as Array<Record<string, unknown>>).map((p) => ({
            ...p,
            userId: (p.userId as { toString(): string } | undefined)?.toString(),
          }));
        }
        delete result._id;
        delete result.__v;
        return result;
      },
    },
  },
);

ConversationSchema.index({ 'participants.userId': 1, lastMessageAt: -1 });
ConversationSchema.index({ orderId: 1 }, { sparse: true });
ConversationSchema.index({ productId: 1 }, { sparse: true });

export const ConversationModel = model<IConversationDocument>('Conversation', ConversationSchema);
