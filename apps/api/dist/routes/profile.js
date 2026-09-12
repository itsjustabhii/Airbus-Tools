"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRouter = void 0;
const express_1 = require("express");
const schemas_1 = require("../auth/schemas");
const service_1 = require("../auth/service");
const errors_1 = require("../core/errors");
const response_1 = require("../core/response");
const UserRepository_1 = require("../database/repositories/UserRepository");
const authenticate_1 = require("../middlewares/authenticate");
const profile_schemas_1 = require("./profile.schemas");
const router = (0, express_1.Router)();
exports.profileRouter = router;
// Require authentication for all profile endpoints
router.use(authenticate_1.authenticate);
/**
 * GET /api/profile (or /api/v1/profile)
 * Returns the currently authenticated user's profile details.
 */
router.get('/', (req, res, next) => {
    void (async () => {
        try {
            const user = await (0, service_1.getMe)(req.user.sub);
            res.status(200).json((0, response_1.successResponse)({ user }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * PATCH /api/profile (or /api/v1/profile)
 * Updates the allowed user profile fields: name, bio, profilePicture (and avatarUrl).
 * Protected fields like email, company, role, status are strictly blocked.
 */
router.patch('/', (req, res, next) => {
    void (async () => {
        try {
            const input = profile_schemas_1.updateProfileSchema.parse(req.body);
            const userId = req.user.sub;
            const updateData = {};
            if (input.name !== undefined) {
                updateData.name = input.name;
                // Also split name into firstName/lastName if present
                const parts = input.name.trim().split(/\s+/);
                if (parts.length > 0 && parts[0]) {
                    updateData.firstName = parts[0];
                    updateData.lastName = parts.slice(1).join(' ') || parts[0];
                }
            }
            if (input.bio !== undefined) {
                updateData.bio = input.bio;
            }
            if (input.profilePicture !== undefined) {
                updateData.profilePicture = input.profilePicture;
                updateData.avatarUrl = input.profilePicture;
            }
            if (input.avatarUrl !== undefined && input.profilePicture === undefined) {
                updateData.avatarUrl = input.avatarUrl;
                updateData.profilePicture = input.avatarUrl;
            }
            const updatedUser = await UserRepository_1.userRepository.updateById(userId, updateData);
            if (!updatedUser) {
                throw new errors_1.NotFoundError('User not found');
            }
            const sanitized = updatedUser.toJSON();
            delete sanitized.passwordHash;
            res.status(200).json((0, response_1.successResponse)({ user: sanitized }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * PATCH /api/profile/password (or /api/v1/profile/password)
 * Updates the user's password verifying their current password first.
 */
router.patch('/password', (req, res, next) => {
    void (async () => {
        try {
            const input = schemas_1.changePasswordSchema.parse(req.body);
            await (0, service_1.changePassword)(req.user.sub, input);
            res.status(200).json((0, response_1.successResponse)({ message: 'Password updated successfully' }));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=profile.js.map