import type { UserRole, UserStatus } from '@airbus-tools/shared';

import { UserModel, type IUserDocument } from '../models/User';

import { BaseRepository, type PaginatedResult, type PaginationOptions } from './BaseRepository';

export interface UserSearchFilter {
  role?: UserRole;
  status?: UserStatus;
  organizationId?: string;
  search?: string;
}

/**
 * Escapes all regex special characters in a string so that it can be safely
 * used inside `new RegExp()` without enabling ReDoS via attacker-controlled input.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class UserRepository extends BaseRepository<IUserDocument> {
  constructor() {
    super(UserModel);
  }

  public async findByEmail(email: string): Promise<IUserDocument | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  public async emailExists(email: string): Promise<boolean> {
    return this.exists({ email: email.toLowerCase().trim() });
  }

  public async findByRoleAndStatus(
    role: UserRole,
    status: UserStatus,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IUserDocument>> {
    return this.findPaginated({ role, status }, options);
  }

  public async findByOrganization(
    organizationId: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IUserDocument>> {
    return this.findPaginated({ organizationId }, options);
  }

  public async updateLastLogin(id: string): Promise<IUserDocument | null> {
    return this.updateById(id, { lastLoginAt: new Date() });
  }

  public async updateStatus(id: string, status: UserStatus): Promise<IUserDocument | null> {
    return this.updateById(id, { status });
  }

  public async searchUsers(
    filter: UserSearchFilter,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IUserDocument>> {
    const query: Record<string, unknown> = {};

    if (filter.role) {
      query.role = filter.role;
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.organizationId) {
      query.organizationId = filter.organizationId;
    }
    if (filter.search) {
      // Escape user input before compiling to regex to prevent ReDoS.
      const safePattern = escapeRegex(filter.search.trim());
      const searchRegex = new RegExp(safePattern, 'i');
      query.$or = [
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
      ];
    }

    return this.findPaginated(query, options);
  }
}

export const userRepository = new UserRepository();
