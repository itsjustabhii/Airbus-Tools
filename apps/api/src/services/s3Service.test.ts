import { describe, it, expect } from 'vitest';

import { ValidationError } from '../core/errors';

import {
  generateSafeObjectKey,
  createPresignedUploadUrl,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './s3Service';

describe('S3 Upload Service', () => {
  const mockUserId = 'user-12345678-abcd-ef00-1122-334455667788';

  describe('generateSafeObjectKey', () => {
    it('generates a key within the safe uploads prefix namespace', () => {
      const key = generateSafeObjectKey(mockUserId, 'image/jpeg');
      expect(key).toMatch(/^uploads\/avatars\/user-12345678-abcd-ef00-1122-334455667788\/[a-f0-9-]+\.jpg$/);
    });

    it('sanitizes directory traversal attempts in userId and prefix', () => {
      const maliciousUserId = '../../etc/passwd';
      const maliciousPrefix = '../../../secret';
      const key = generateSafeObjectKey(maliciousUserId, 'image/png', 'photo.png', maliciousPrefix);

      expect(key).not.toContain('..');
      expect(key).toMatch(/^uploads\/secret\/etcpasswd\/[a-f0-9-]+\.png$/);
    });

    it('correctly maps valid file extensions from content type', () => {
      expect(generateSafeObjectKey(mockUserId, 'image/webp')).toMatch(/\.webp$/);
      expect(generateSafeObjectKey(mockUserId, 'image/png')).toMatch(/\.png$/);
      expect(generateSafeObjectKey(mockUserId, 'image/gif')).toMatch(/\.gif$/);
    });
  });

  describe('createPresignedUploadUrl', () => {
    it('generates a presigned upload URL and safe object key for valid image payload', async () => {
      const result = await createPresignedUploadUrl({
        userId: mockUserId,
        contentType: 'image/png',
        fileSize: 1024 * 500, // 500 KB
        fileName: 'my-avatar.png',
      });

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('fileUrl');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('expiresIn', 300);

      expect(result.uploadUrl).toContain('https://');
      expect(result.uploadUrl).toContain('airbus-tools-uploads');
      expect(result.uploadUrl).toContain(result.key);
      expect(result.key).toMatch(/^uploads\/avatars\/user-12345678-abcd-ef00-1122-334455667788\/[a-f0-9-]+\.png$/);
    });

    it('rejects disallowed content types', async () => {
      await expect(
        createPresignedUploadUrl({
          userId: mockUserId,
          contentType: 'application/pdf',
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        createPresignedUploadUrl({
          userId: mockUserId,
          contentType: 'application/x-sh',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects files exceeding maximum file size limit', async () => {
      await expect(
        createPresignedUploadUrl({
          userId: mockUserId,
          contentType: 'image/jpeg',
          fileSize: MAX_FILE_SIZE_BYTES + 1,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects files with 0 or negative size', async () => {
      await expect(
        createPresignedUploadUrl({
          userId: mockUserId,
          contentType: 'image/jpeg',
          fileSize: 0,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });
});
