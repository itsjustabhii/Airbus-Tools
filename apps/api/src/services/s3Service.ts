import path from 'path';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../config/env';
import { ValidationError } from '../core/errors';

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Maximum file size: 5MB for profile pictures / avatar images
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const PRESIGNED_URL_EXPIRATION_SECONDS = 300; // 5 minutes

export interface GeneratePresignedUploadUrlOptions {
  userId: string;
  contentType: string;
  fileSize?: number | undefined;
  fileName?: string | undefined;
  prefix?: string | undefined;
}

export interface PresignedUploadUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const s3Config: {
      region: string;
      credentials?: { accessKeyId: string; secretAccessKey: string };
      endpoint?: string;
      forcePathStyle?: boolean;
    } = {
      region: config.AWS_REGION,
    };

    if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      };
    }

    if (config.AWS_S3_ENDPOINT) {
      s3Config.endpoint = config.AWS_S3_ENDPOINT;
      s3Config.forcePathStyle = true;
    }

    s3ClientInstance = new S3Client(s3Config);
  }
  return s3ClientInstance;
}

/**
 * Generates a safe, collision-resistant object key.
 * Path format: uploads/{prefix}/{userId}/{uuid}.{ext}
 * Sanitizes extensions and ignores user-supplied path separators.
 */
export function generateSafeObjectKey(userId: string, contentType: string, fileName?: string, prefix = 'avatars'): string {
  const allowedExt = ALLOWED_IMAGE_TYPES[contentType];
  let ext = allowedExt;

  if (fileName) {
    const rawExt = path.extname(fileName).replace(/^\./, '').toLowerCase();
    if (rawExt && Object.values(ALLOWED_IMAGE_TYPES).includes(rawExt)) {
      ext = rawExt;
    }
  }

  // Sanitize userId and prefix to avoid directory traversal
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueId = uuidv4();

  return `uploads/${safePrefix}/${safeUserId}/${uniqueId}.${ext}`;
}

/**
 * Creates an authorized presigned PUT URL for uploading files to S3.
 * Preserves strict content-type and size validation.
 */
export async function createPresignedUploadUrl(
  options: GeneratePresignedUploadUrlOptions,
): Promise<PresignedUploadUrlResult> {
  const { userId, contentType, fileSize, fileName, prefix = 'avatars' } = options;

  if (!ALLOWED_IMAGE_TYPES[contentType]) {
    throw new ValidationError(
      `Invalid content type: ${contentType}. Allowed types are: ${Object.keys(ALLOWED_IMAGE_TYPES).join(', ')}`,
    );
  }

  if (fileSize !== undefined) {
    if (fileSize <= 0) {
      throw new ValidationError('File size must be greater than 0 bytes');
    }
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File size (${fileSize} bytes) exceeds the maximum allowed limit of ${MAX_FILE_SIZE_BYTES} bytes (5MB)`,
      );
    }
  }

  const key = generateSafeObjectKey(userId, contentType, fileName, prefix);
  const s3 = getS3Client();

  const command = new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    // ContentLength is always set — required to enforce size limits in the presigned URL
    ...(fileSize !== undefined ? { ContentLength: fileSize } : {}),
    Metadata: {
      'uploaded-by': userId,
      'original-filename': fileName ? path.basename(fileName).replace(/[^\x20-\x7E]/g, '') : '',
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGNED_URL_EXPIRATION_SECONDS,
  });

  // Construct public/accessible S3 file URL
  const endpoint = config.AWS_S3_ENDPOINT;
  let fileUrl: string;
  if (endpoint) {
    // Custom endpoint (e.g. MinIO / LocalStack)
    fileUrl = `${endpoint.replace(/\/$/, '')}/${config.AWS_S3_BUCKET}/${key}`;
  } else {
    fileUrl = `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
  }

  return {
    uploadUrl,
    fileUrl,
    key,
    expiresIn: PRESIGNED_URL_EXPIRATION_SECONDS,
  };
}
