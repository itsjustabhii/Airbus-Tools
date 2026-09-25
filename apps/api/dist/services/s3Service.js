"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESIGNED_URL_EXPIRATION_SECONDS = exports.MAX_FILE_SIZE_BYTES = exports.ALLOWED_IMAGE_TYPES = void 0;
exports.getS3Client = getS3Client;
exports.generateSafeObjectKey = generateSafeObjectKey;
exports.createPresignedUploadUrl = createPresignedUploadUrl;
const path_1 = __importDefault(require("path"));
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const uuid_1 = require("uuid");
const env_1 = require("../config/env");
const errors_1 = require("../core/errors");
exports.ALLOWED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};
// Maximum file size: 5MB for profile pictures / avatar images
exports.MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
exports.PRESIGNED_URL_EXPIRATION_SECONDS = 300; // 5 minutes
let s3ClientInstance = null;
function getS3Client() {
    if (!s3ClientInstance) {
        const s3Config = {
            region: env_1.config.AWS_REGION,
        };
        if (env_1.config.AWS_ACCESS_KEY_ID && env_1.config.AWS_SECRET_ACCESS_KEY) {
            s3Config.credentials = {
                accessKeyId: env_1.config.AWS_ACCESS_KEY_ID,
                secretAccessKey: env_1.config.AWS_SECRET_ACCESS_KEY,
            };
        }
        if (env_1.config.AWS_S3_ENDPOINT) {
            s3Config.endpoint = env_1.config.AWS_S3_ENDPOINT;
            s3Config.forcePathStyle = true;
        }
        s3ClientInstance = new client_s3_1.S3Client(s3Config);
    }
    return s3ClientInstance;
}
/**
 * Generates a safe, collision-resistant object key.
 * Path format: uploads/{prefix}/{userId}/{uuid}.{ext}
 * Sanitizes extensions and ignores user-supplied path separators.
 */
function generateSafeObjectKey(userId, contentType, fileName, prefix = 'avatars') {
    const allowedExt = exports.ALLOWED_IMAGE_TYPES[contentType];
    let ext = allowedExt;
    if (fileName) {
        const rawExt = path_1.default.extname(fileName).replace(/^\./, '').toLowerCase();
        if (rawExt && Object.values(exports.ALLOWED_IMAGE_TYPES).includes(rawExt)) {
            ext = rawExt;
        }
    }
    // Sanitize userId and prefix to avoid directory traversal
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
    const uniqueId = (0, uuid_1.v4)();
    return `uploads/${safePrefix}/${safeUserId}/${uniqueId}.${ext}`;
}
/**
 * Creates an authorized presigned PUT URL for uploading files to S3.
 * Preserves strict content-type and size validation.
 */
async function createPresignedUploadUrl(options) {
    const { userId, contentType, fileSize, fileName, prefix = 'avatars' } = options;
    if (!exports.ALLOWED_IMAGE_TYPES[contentType]) {
        throw new errors_1.ValidationError(`Invalid content type: ${contentType}. Allowed types are: ${Object.keys(exports.ALLOWED_IMAGE_TYPES).join(', ')}`);
    }
    if (fileSize !== undefined) {
        if (fileSize <= 0) {
            throw new errors_1.ValidationError('File size must be greater than 0 bytes');
        }
        if (fileSize > exports.MAX_FILE_SIZE_BYTES) {
            throw new errors_1.ValidationError(`File size (${fileSize} bytes) exceeds the maximum allowed limit of ${exports.MAX_FILE_SIZE_BYTES} bytes (5MB)`);
        }
    }
    const key = generateSafeObjectKey(userId, contentType, fileName, prefix);
    const s3 = getS3Client();
    const command = new client_s3_1.PutObjectCommand({
        Bucket: env_1.config.AWS_S3_BUCKET,
        Key: key,
        ContentType: contentType,
        // ContentLength is always set — required to enforce size limits in the presigned URL
        ...(fileSize !== undefined ? { ContentLength: fileSize } : {}),
        Metadata: {
            'uploaded-by': userId,
            'original-filename': fileName ? path_1.default.basename(fileName).replace(/[^\x20-\x7E]/g, '') : '',
        },
    });
    const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, {
        expiresIn: exports.PRESIGNED_URL_EXPIRATION_SECONDS,
    });
    // Construct public/accessible S3 file URL
    const endpoint = env_1.config.AWS_S3_ENDPOINT;
    let fileUrl;
    if (endpoint) {
        // Custom endpoint (e.g. MinIO / LocalStack)
        fileUrl = `${endpoint.replace(/\/$/, '')}/${env_1.config.AWS_S3_BUCKET}/${key}`;
    }
    else {
        fileUrl = `https://${env_1.config.AWS_S3_BUCKET}.s3.${env_1.config.AWS_REGION}.amazonaws.com/${key}`;
    }
    return {
        uploadUrl,
        fileUrl,
        key,
        expiresIn: exports.PRESIGNED_URL_EXPIRATION_SECONDS,
    };
}
//# sourceMappingURL=s3Service.js.map