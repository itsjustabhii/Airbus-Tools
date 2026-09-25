"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presignedUrlSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
const env_1 = require("../config/env");
const s3Service_1 = require("../services/s3Service");
/**
 * Build a validator that only accepts URLs on the configured S3 bucket
 * (or the configured custom endpoint for local dev).
 * Falls back to accepting any HTTPS URL when the bucket name is the default.
 */
function buildMediaUrlValidator() {
    const bucketName = env_1.config.AWS_S3_BUCKET;
    const region = env_1.config.AWS_REGION;
    const customEndpoint = env_1.config.AWS_S3_ENDPOINT;
    // Allowed hostname patterns for media URLs
    const allowedPatterns = [
        new RegExp(`^https://${bucketName}\\.s3\\.${region}\\.amazonaws\\.com/`),
        new RegExp(`^https://${bucketName}\\.s3\\.amazonaws\\.com/`),
        new RegExp(`^https://s3\\.${region}\\.amazonaws\\.com/${bucketName}/`),
    ];
    if (customEndpoint) {
        const escaped = customEndpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/$/, '');
        allowedPatterns.push(new RegExp(`^${escaped}/`));
    }
    return zod_1.z
        .string()
        .url()
        .refine((url) => url === '' || allowedPatterns.some((p) => p.test(url)), { message: 'Media URL must point to the configured storage bucket' })
        .optional()
        .or(zod_1.z.literal(''));
}
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
    profilePicture: buildMediaUrlValidator(),
    avatarUrl: buildMediaUrlValidator(),
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
    /**
     * File size is required — it is embedded in the PutObject presigned URL as
     * ContentLength, ensuring the caller cannot upload beyond the declared size.
     * Omitting this would allow arbitrarily large S3 uploads that bypass the 5MB limit.
     */
    fileSize: zod_1.z
        .number()
        .int('File size must be an integer')
        .positive('File size must be greater than 0')
        .max(s3Service_1.MAX_FILE_SIZE_BYTES, `File size exceeds maximum allowed limit of ${s3Service_1.MAX_FILE_SIZE_BYTES} bytes (5MB)`),
    fileName: zod_1.z.string().trim().max(255, 'File name cannot exceed 255 characters').optional(),
    prefix: zod_1.z.string().trim().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid prefix format').optional(),
});
//# sourceMappingURL=profile.schemas.js.map