"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_COOKIE_NAME = void 0;
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.getMe = getMe;
exports.changePassword = changePassword;
const shared_1 = require("@airbus-tools/shared");
const bcrypt_1 = __importDefault(require("bcrypt"));
const errors_1 = require("../core/errors");
const UserRepository_1 = require("../database/repositories/UserRepository");
const queues_1 = require("../jobs/queues");
const jwt_1 = require("./jwt");
const BCRYPT_ROUNDS = 12;
exports.AUTH_COOKIE_NAME = 'access_token';
/**
 * Strips passwordHash from a Mongoose document and returns a plain user object.
 * The UserSchema toJSON transform also strips it, but we use lean-style access here
 * so we apply the transform manually.
 */
function sanitizeUser(user) {
    if (!user)
        return null;
    const obj = user.toJSON();
    delete obj.passwordHash;
    return obj;
}
async function registerUser(input) {
    const exists = await UserRepository_1.userRepository.emailExists(input.email);
    if (exists) {
        throw new errors_1.ConflictError('An account with this email already exists');
    }
    const passwordHash = await bcrypt_1.default.hash(input.password, BCRYPT_ROUNDS);
    const createData = {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        role: input.role,
        status: shared_1.UserStatus.ACTIVE,
    };
    if (input.phoneNumber) {
        createData.phoneNumber = input.phoneNumber;
    }
    const user = await UserRepository_1.userRepository.create(createData);
    const token = (0, jwt_1.signToken)({ sub: String(user._id), email: user.email, role: user.role });
    // Enqueue welcome email — fire-and-forget, does NOT block the response.
    void (0, queues_1.enqueueEmail)({
        name: 'send-welcome',
        jobId: (0, queues_1.newJobId)(),
        to: user.email,
        recipientName: user.firstName,
        userId: String(user._id),
    });
    return { token, user: sanitizeUser(user) };
}
async function loginUser(input) {
    // Fetch user with passwordHash (toJSON strips it, so use direct property access)
    const user = await UserRepository_1.userRepository.findByEmail(input.email);
    // Use constant-time compare even when user doesn't exist (prevents timing attacks)
    const dummyHash = '$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const hash = user?.passwordHash ?? dummyHash;
    const isMatch = await bcrypt_1.default.compare(input.password, hash);
    if (!user || !isMatch) {
        throw new errors_1.UnauthorizedError('Invalid email or password');
    }
    if (user.status !== shared_1.UserStatus.ACTIVE) {
        throw new errors_1.UnauthorizedError('Account is not active');
    }
    await UserRepository_1.userRepository.updateLastLogin(String(user._id));
    const token = (0, jwt_1.signToken)({ sub: String(user._id), email: user.email, role: user.role });
    return { token, user: sanitizeUser(user) };
}
async function getMe(userId) {
    const user = await UserRepository_1.userRepository.findById(userId);
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    return sanitizeUser(user);
}
async function changePassword(userId, input) {
    const user = await UserRepository_1.userRepository.findById(userId);
    if (!user) {
        throw new errors_1.NotFoundError('User not found');
    }
    const isMatch = await bcrypt_1.default.compare(input.currentPassword, user.passwordHash);
    if (!isMatch) {
        throw new errors_1.UnauthorizedError('Current password is incorrect');
    }
    const newHash = await bcrypt_1.default.hash(input.newPassword, BCRYPT_ROUNDS);
    await UserRepository_1.userRepository.updateById(userId, { passwordHash: newHash });
    // Enqueue password-changed notification — fire-and-forget.
    void (0, queues_1.enqueueEmail)({
        name: 'send-password-changed',
        jobId: (0, queues_1.newJobId)(),
        to: user.email,
        recipientName: user.firstName,
        userId: userId,
        changedAt: new Date().toISOString(),
    });
}
//# sourceMappingURL=service.js.map