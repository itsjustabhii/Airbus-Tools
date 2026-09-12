"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("@airbus-tools/shared");
// Only AIRLINE and SUPPLIER can self-register
const REGISTERABLE_ROLES = [shared_1.UserRole.AIRLINE, shared_1.UserRole.SUPPLIER];
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').toLowerCase().trim(),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must not exceed 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one digit'),
    firstName: zod_1.z.string().trim().min(1, 'First name is required').max(100),
    lastName: zod_1.z.string().trim().min(1, 'Last name is required').max(100),
    role: zod_1.z.enum(REGISTERABLE_ROLES, {
        errorMap: () => ({ message: `Role must be one of: ${REGISTERABLE_ROLES.join(', ')}` }),
    }),
    phoneNumber: zod_1.z.string().trim().max(30).optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').toLowerCase().trim(),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must not exceed 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one digit'),
});
//# sourceMappingURL=schemas.js.map