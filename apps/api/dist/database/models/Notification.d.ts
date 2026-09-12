import { Schema, type Document, type Types } from 'mongoose';
import { NotificationType } from '@airbus-tools/shared';
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
export declare const NotificationSchema: Schema<INotificationDocument, import("mongoose").Model<INotificationDocument, any, any, any, Document<unknown, any, INotificationDocument, any, {}> & INotificationDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, INotificationDocument, Document<unknown, {}, import("mongoose").FlatRecord<INotificationDocument>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<INotificationDocument> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const NotificationModel: import("mongoose").Model<INotificationDocument, {}, {}, {}, Document<unknown, {}, INotificationDocument, {}, {}> & INotificationDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Notification.d.ts.map