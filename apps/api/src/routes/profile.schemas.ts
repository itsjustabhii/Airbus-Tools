import { z } from 'zod';

import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from '../services/s3Service';
import { config } from '../config/env';

/**
 * Build a validator that only accepts URLs on the configured S3 bucket
 * (or the configured custom endpoint for local dev).
 * Falls back to accepting any HTTPS URL when the bucket name is the default.
 */
function buildMediaUrlValidator() {
  const bucketName = config.AWS_S3_BUCKET;
  const region = config.AWS_REGION;
  const customEndpoint = config.AWS_S3_ENDPOINT;

  // Allowed hostname patterns for media URLs
  const allowedPatterns: RegExp[] = [
    new RegExp(`^https://${bucketName}\\.s3\\.${region}\\.amazonaws\\.com/`),
    new RegExp(`^https://${bucketName}\\.s3\\.amazonaws\\.com/`),
    new RegExp(`^https://s3\\.${region}\\.amazonaws\\.com/${bucketName}/`),
  ];

  if (customEndpoint) {
    const escaped = customEndpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/$/, '');
    allowedPatterns.push(new RegExp(`^${escaped}/`));
  }

  return z
    .string()
    .url()
    .refine(
      (url) => url === '' || allowedPatterns.some((p) => p.test(url)),
      { message: 'Media URL must point to the configured storage bucket' },
    )
    .optional()
    .or(z.literal(''));
}

/**
 * Schema for updating user profile.
 * Users may modify: name, bio, profile picture (avatarUrl / profilePicture).
 * Users CANNOT modify: email, company, role, status, id, password, organizationId.
 * Strips unknown fields and explicitly prevents attempts to alter protected fields.
 */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().max(200, 'Name cannot exceed 200 characters').optional(),
    bio: z.string().trim().max(1000, 'Bio cannot exceed 1000 characters').optional(),
    profilePicture: buildMediaUrlValidator(),
    avatarUrl: buildMediaUrlValidator(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Schema for generating a presigned S3 upload URL.
 */
export const presignedUrlSchema = z.object({
  contentType: z
    .string()
    .trim()
    .refine((type) => Boolean(ALLOWED_IMAGE_TYPES[type]), {
      message: `Invalid content type. Allowed types are: ${Object.keys(ALLOWED_IMAGE_TYPES).join(', ')}`,
    }),
  /**
   * File size is required — it is embedded in the PutObject presigned URL as
   * ContentLength, ensuring the caller cannot upload beyond the declared size.
   * Omitting this would allow arbitrarily large S3 uploads that bypass the 5MB limit.
   */
  fileSize: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be greater than 0')
    .max(
      MAX_FILE_SIZE_BYTES,
      `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES} bytes (5MB)`,
    ),
  fileName: z.string().trim().max(255, 'File name cannot exceed 255 characters').optional(),
  prefix: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid prefix format').optional(),
});

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
