"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = require("express");
const response_1 = require("../core/response");
const authenticate_1 = require("../middlewares/authenticate");
const s3Service_1 = require("../services/s3Service");
const profile_schemas_1 = require("./profile.schemas");
const router = (0, express_1.Router)();
exports.uploadRouter = router;
// Upload generation is restricted to authenticated users (no public write access)
router.use(authenticate_1.authenticate);
/**
 * POST /api/uploads/presigned-url (or /api/v1/uploads/presigned-url)
 * Generates an authorized S3 PUT pre-signed URL for direct image uploading.
 */
router.post('/presigned-url', (req, res, next) => {
    void (async () => {
        try {
            const input = profile_schemas_1.presignedUrlSchema.parse(req.body);
            const userId = req.user.sub;
            const result = await (0, s3Service_1.createPresignedUploadUrl)({
                userId,
                contentType: input.contentType,
                fileSize: input.fileSize,
                fileName: input.fileName,
                prefix: input.prefix || 'avatars',
            });
            res.status(200).json((0, response_1.successResponse)(result));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=upload.js.map