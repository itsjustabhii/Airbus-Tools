"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModel = exports.NotificationSchema = void 0;
const mongoose_1 = require("mongoose");
const shared_1 = require("@airbus-tools/shared");
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
exports.NotificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
    },
    type: {
        type: String,
        enum: Object.values(shared_1.NotificationType),
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
        type: mongoose_1.Schema.Types.Mixed,
        default: null,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.id = ret._id.toString();
            ret.userId = ret.userId?.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        },
    },
});
exports.NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
exports.NotificationSchema.index({ userId: 1, createdAt: -1 });
exports.NotificationModel = (0, mongoose_1.model)('Notification', exports.NotificationSchema);
//# sourceMappingURL=Notification.js.map