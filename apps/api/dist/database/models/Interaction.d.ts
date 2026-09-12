import { InteractionType } from '@airbus-tools/shared';
import { Schema, type Document, type Types } from 'mongoose';
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
export declare const InteractionSchema: Schema<IInteractionDocument, import("mongoose").Model<IInteractionDocument, any, any, any, Document<unknown, any, IInteractionDocument, any, {}> & IInteractionDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IInteractionDocument, Document<unknown, {}, import("mongoose").FlatRecord<IInteractionDocument>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<IInteractionDocument> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const InteractionModel: import("mongoose").Model<IInteractionDocument, {}, {}, {}, Document<unknown, {}, IInteractionDocument, {}, {}> & IInteractionDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Interaction.d.ts.map