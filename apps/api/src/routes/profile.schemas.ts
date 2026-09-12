import { z } from 'zod';

import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from '../services/s3Service';

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
    profilePicture: z.string().url('Profile picture must be a valid URL').optional().or(z.literal('')),
    avatarUrl: z.string().url('Avatar URL must be a valid URL').optional().or(z.literal('')),
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
  fileSize: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be greater than 0')
    .max(
      MAX_FILE_SIZE_BYTES,
      `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES} bytes (5MB)`,
    )
    .optional(),
  fileName: z.string().trim().max(255, 'File name cannot exceed 255 characters').optional(),
  prefix: z.string().trim().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid prefix format').optional(),
});

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
