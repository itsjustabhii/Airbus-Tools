"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = exports.UserSchema = void 0;
const shared_1 = require("@airbus-tools/shared");
const mongoose_1 = require("mongoose");
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
    name: {
        type: String,
        trim: true,
        maxlength: [200, 'Name cannot exceed 200 characters'],
        default: null,
    },
    bio: {
        type: String,
        trim: true,
        maxlength: [1000, 'Bio cannot exceed 1000 characters'],
        default: null,
    },
    company: {
        type: String,
        trim: true,
        maxlength: [200, 'Company cannot exceed 200 characters'],
        default: null,
    },
    passwordHash: {
        type: String,
        required: [true, 'Password hash is required'],
    },
    role: {
        type: String,
        enum: Object.values(shared_1.UserRole),
        default: shared_1.UserRole.AIRLINE,
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
    profilePicture: {
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
            const result = ret;
            result.id = result._id.toString();
            delete result._id;
            delete result.__v;
            delete result.passwordHash;
            return result;
        },
    },
});
exports.UserSchema.index({ role: 1, status: 1 });
exports.UserSchema.index({ organizationId: 1 }, { sparse: true });
exports.UserModel = (0, mongoose_1.model)('User', exports.UserSchema);
//# sourceMappingURL=User.js.map