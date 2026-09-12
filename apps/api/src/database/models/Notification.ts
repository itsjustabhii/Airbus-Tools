import { NotificationType } from '@airbus-tools/shared';
import { Schema, model, type Document, type Types } from 'mongoose';

export interface INotificationDocument extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: Date;
  referenceEntityType?: 'ORDER' | 'PAYMENT' | 'MESSAGE' | 'PRODUCT';
  referenceEntityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification Schema definition
 * 
 * Index Rationale:
 * 1. { userId: 1, isRead: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: User notification bell dropdown (unread count + chronological listing).
 *    - Rationale: High-frequency user query. Perfect ESR compliance for `{ userId, isRead }` filter + `createdAt` sort.
 * 2. { userId: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: User notification center history (all alerts read & unread).
 *    - Rationale: Optimal reverse-chronological pagination.
 */
export const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    referenceEntityType: {
      type: String,
      enum: ['ORDER', 'PAYMENT', 'MESSAGE', 'PRODUCT'],
      default: null,
    },
    referenceEntityId: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
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
        if (result.userId) {
          result.userId = (result.userId as { toString(): string }).toString();
        }
        delete result._id;
        delete result.__v;
        return result;
      },
    },
  },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const NotificationModel = model<INotificationDocument>('Notification', NotificationSchema);
