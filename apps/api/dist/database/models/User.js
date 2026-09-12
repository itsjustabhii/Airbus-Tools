"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = exports.UserSchema = void 0;
const mongoose_1 = require("mongoose");
const shared_1 = require("@airbus-tools/shared");
/**
 * User Schema definition
 *
 * Index Rationale:
 * 1. { email: 1 } (Unique, Case-insensitive Collation / Lowercase)
 *    - Query Pattern: User authentication (login), email lookup, duplicate check during registration.
 *    - Rationale: High selectivity, unique constraint guarantees integrity.
 * 2. { role: 1, status: 1 } (Compound)
 *    - Query Pattern: Admin/moderator dashboard filtering users by their roles and active status.
 *    - Rationale: Multi-attribute equality filtering for workforce and access management.
 * 3. { organizationId: 1 } (Sparse)
 *    - Query Pattern: Fetching all members of a specific organization.
 *    - Rationale: Organization multi-tenancy and team member listing.
 */
exports.UserSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [100, 'First name cannot exceed 100 characters'],
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [100, 'Last name cannot exceed 100 characters'],
    },
    passwordHash: {
        type: String,
        required: [true, 'Password hash is required'],
    },
    role: {
        type: String,
        enum: Object.values(shared_1.UserRole),
        default: shared_1.UserRole.BUYER,
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(shared_1.UserStatus),
        default: shared_1.UserStatus.PENDING_VERIFICATION,
        required: true,
    },
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        default: null,
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: null,
    },
    avatarUrl: {
        type: String,
        trim: true,
        default: null,
    },
    lastLoginAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            delete ret.passwordHash;
            return ret;
        },
    },
});
exports.UserSchema.index({ role: 1, status: 1 });
exports.UserSchema.index({ organizationId: 1 }, { sparse: true });
exports.UserModel = (0, mongoose_1.model)('User', exports.UserSchema);
//# sourceMappingURL=User.js.map