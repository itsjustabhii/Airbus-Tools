import { UserRole, UserStatus } from '@airbus-tools/shared';
import { Schema, type Document } from 'mongoose';
export interface IUserDocument extends Document {
    email: string;
    firstName: string;
    lastName: string;
    name?: string;
    bio?: string;
    company?: string;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
    organizationId?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    profilePicture?: string;
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
export declare const UserSchema: Schema<IUserDocument, import("mongoose").Model<IUserDocument, any, any, any, Document<unknown, any, IUserDocument, any, {}> & IUserDocument & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IUserDocument, Document<unknown, {}, import("mongoose").FlatRecord<IUserDocument>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<IUserDocument> & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const UserModel: import("mongoose").Model<IUserDocument, {}, {}, {}, Document<unknown, {}, IUserDocument, {}, {}> & IUserDocument & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=User.d.ts.map