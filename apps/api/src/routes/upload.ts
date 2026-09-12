import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';

import { successResponse } from '../core/response';
import { authenticate } from '../middlewares/authenticate';
import { createPresignedUploadUrl } from '../services/s3Service';
import { presignedUrlSchema } from './profile.schemas';

const router: Router = createRouter();

// Upload generation is restricted to authenticated users (no public write access)
router.use(authenticate);

/**
 * POST /api/uploads/presigned-url (or /api/v1/uploads/presigned-url)
 * Generates an authorized S3 PUT pre-signed URL for direct image uploading.
 */
router.post('/presigned-url', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const input = presignedUrlSchema.parse(req.body);
      const userId = req.user!.sub;

      const result = await createPresignedUploadUrl({
        userId,
        contentType: input.contentType,
        fileSize: input.fileSize,
        fileName: input.fileName,
        prefix: input.prefix || 'avatars',
      });

      res.status(200).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  })();
});

export { router as uploadRouter };
