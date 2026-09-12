import { type IUserDocument } from '../models/User';
import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';
import { UserRole, UserStatus } from '@airbus-tools/shared';
export interface UserSearchFilter {
    role?: UserRole;
    status?: UserStatus;
    organizationId?: string;
    search?: string;
}
export declare class UserRepository extends BaseRepository<IUserDocument> {
    constructor();
    findByEmail(email: string): Promise<IUserDocument | null>;
    emailExists(email: string): Promise<boolean>;
    findByRoleAndStatus(role: UserRole, status: UserStatus, options?: PaginationOptions): Promise<PaginatedResult<IUserDocument>>;
    findByOrganization(organizationId: string, options?: PaginationOptions): Promise<PaginatedResult<IUserDocument>>;
    updateLastLogin(id: string): Promise<IUserDocument | null>;
    updateStatus(id: string, status: UserStatus): Promise<IUserDocument | null>;
    searchUsers(filter: UserSearchFilter, options?: PaginationOptions): Promise<PaginatedResult<IUserDocument>>;
}
export declare const userRepository: UserRepository;
//# sourceMappingURL=UserRepository.d.ts.map