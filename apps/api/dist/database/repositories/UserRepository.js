"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const User_1 = require("../models/User");
const BaseRepository_1 = require("./BaseRepository");
/**
 * Escapes all regex special characters in a string so that it can be safely
 * used inside `new RegExp()` without enabling ReDoS via attacker-controlled input.
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
class UserRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super(User_1.UserModel);
    }
    async findByEmail(email) {
        return this.findOne({ email: email.toLowerCase().trim() });
    }
    async emailExists(email) {
        return this.exists({ email: email.toLowerCase().trim() });
    }
    async findByRoleAndStatus(role, status, options) {
        return this.findPaginated({ role, status }, options);
    }
    async findByOrganization(organizationId, options) {
        return this.findPaginated({ organizationId }, options);
    }
    async updateLastLogin(id) {
        return this.updateById(id, { lastLoginAt: new Date() });
    }
    async updateStatus(id, status) {
        return this.updateById(id, { status });
    }
    async searchUsers(filter, options) {
        const query = {};
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
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
//# sourceMappingURL=UserRepository.js.map