import { S3Client } from '@aws-sdk/client-s3';
export declare const ALLOWED_IMAGE_TYPES: Record<string, string>;
export declare const MAX_FILE_SIZE_BYTES: number;
export declare const PRESIGNED_URL_EXPIRATION_SECONDS = 300;
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
export declare function getS3Client(): S3Client;
/**
 * Generates a safe, collision-resistant object key.
 * Path format: uploads/{prefix}/{userId}/{uuid}.{ext}
 * Sanitizes extensions and ignores user-supplied path separators.
 */
export declare function generateSafeObjectKey(userId: string, contentType: string, fileName?: string, prefix?: string): string;
/**
 * Creates an authorized presigned PUT URL for uploading files to S3.
 * Preserves strict content-type and size validation.
 */
export declare function createPresignedUploadUrl(options: GeneratePresignedUploadUrlOptions): Promise<PresignedUploadUrlResult>;
//# sourceMappingURL=s3Service.d.ts.map