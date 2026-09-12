"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presignedUrlSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
const s3Service_1 = require("../services/s3Service");
/**
 * Schema for updating user profile.
 * Users may modify: name, bio, profile picture (avatarUrl / profilePicture).
 * Users CANNOT modify: email, company, role, status, id, password, organizationId.
 * Strips unknown fields and explicitly prevents attempts to alter protected fields.
 */
exports.updateProfileSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().max(200, 'Name cannot exceed 200 characters').optional(),
    bio: zod_1.z.string().trim().max(1000, 'Bio cannot exceed 1000 characters').optional(),
    profilePicture: zod_1.z.string().url('Profile picture must be a valid URL').optional().or(zod_1.z.literal('')),
    avatarUrl: zod_1.z.string().url('Avatar URL must be a valid URL').optional().or(zod_1.z.literal('')),
})
    .strict();
/**
 * Schema for generating a presigned S3 upload URL.
 */
exports.presignedUrlSchema = zod_1.z.object({
    contentType: zod_1.z
        .string()
        .trim()
        .refine((type) => Boolean(s3Service_1.ALLOWED_IMAGE_TYPES[type]), {
        message: `Invalid content type. Allowed types are: ${Object.keys(s3Service_1.ALLOWED_IMAGE_TYPES).join(', ')}`,
    }),
    fileSize: zod_1.z
        .number()
        .int('File size must be an integer')
        .positive('File size must be greater than 0')
        .max(s3Service_1.MAX_FILE_SIZE_BYTES, `File size exceeds maximum allowed limit of ${s3Service_1.MAX_FILE_SIZE_BYTES} bytes (5MB)`)
        .optional(),
    fileName: zod_1.z.string().trim().max(255, 'File name cannot exceed 255 characters').optional(),
    prefix: zod_1.z.string().trim().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid prefix format').optional(),
});
//# sourceMappingURL=profile.schemas.js.map