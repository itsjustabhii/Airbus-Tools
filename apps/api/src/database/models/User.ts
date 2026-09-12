import { UserRole, UserStatus } from '@airbus-tools/shared';
import { Schema, model, type Document } from 'mongoose';

export interface IUserDocument extends Document {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  organizationId?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
export const UserSchema = new Schema<IUserDocument>(
  {
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
      enum: Object.values(UserRole),
      default: UserRole.AIRLINE,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_VERIFICATION,
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const result = ret as Record<string, unknown>;
        result.id = (result._id as { toString(): string }).toString();
        delete result._id;
        delete result.__v;
        delete result.passwordHash;
        return result;
      },
    },
  },
);

UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ organizationId: 1 }, { sparse: true });

export const UserModel = model<IUserDocument>('User', UserSchema);
