import { InteractionType } from '@airbus-tools/shared';
import { Schema, model, type Document, type Types } from 'mongoose';

export interface IInteractionDocument extends Document {
  userId?: Types.ObjectId;
  anonymousId?: string;
  type: InteractionType;
  entityType: 'PRODUCT' | 'ORDER' | 'USER' | 'SEARCH';
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interaction Schema definition
 * 
 * Index Rationale:
 * 1. { userId: 1, createdAt: -1 } (Compound / Sparse)
 *    - Query Pattern: User behavioral analytics, recommendation engine history, audit log of actions.
 *    - Rationale: Time-series user journey tracking.
 * 2. { entityType: 1, entityId: 1, type: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: Product view counts, conversion rate calculations, RFQ interest metrics.
 *    - Rationale: Fast aggregation and analytics on entity-level interactions.
 * 3. { anonymousId: 1, createdAt: -1 } (Compound / Sparse)
 *    - Query Pattern: Stitching guest user browsing sessions once they register or log in.
 *    - Rationale: Unauthenticated funnel analytics.
 * 4. { createdAt: 1 } (TTL or Log Partitioning)
 *    - Query Pattern: Time-range queries for daily/weekly BI aggregation and metrics reporting.
 *    - Rationale: Fast time-window filtering.
 */
export const InteractionSchema = new Schema<IInteractionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    anonymousId: {
      type: String,
      trim: true,
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(InteractionType),
      required: [true, 'Interaction type is required'],
    },
    entityType: {
      type: String,
      enum: ['PRODUCT', 'ORDER', 'USER', 'SEARCH'],
      required: [true, 'Entity type is required'],
    },
    entityId: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
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

InteractionSchema.index({ userId: 1, createdAt: -1 }, { sparse: true });
InteractionSchema.index({ entityType: 1, entityId: 1, type: 1, createdAt: -1 });
InteractionSchema.index({ anonymousId: 1, createdAt: -1 }, { sparse: true });
InteractionSchema.index({ createdAt: 1 });

export const InteractionModel = model<IInteractionDocument>('Interaction', InteractionSchema);
