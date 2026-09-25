import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';

import { changePasswordSchema } from '../auth/schemas';
import { changePassword, getMe } from '../auth/service';
import { NotFoundError } from '../core/errors';
import { successResponse } from '../core/response';
import { userRepository } from '../database/repositories/UserRepository';
import { authenticate } from '../middlewares/authenticate';

import { updateProfileSchema } from './profile.schemas';

const router: Router = createRouter();

// Require authentication for all profile endpoints
router.use(authenticate);

/**
 * GET /api/profile (or /api/v1/profile)
 * Returns the currently authenticated user's profile details.
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const user = await getMe(req.user!.sub);
      res.status(200).json(successResponse({ user }));
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * PATCH /api/profile (or /api/v1/profile)
 * Updates the allowed user profile fields: name, bio, profilePicture (and avatarUrl).
 * Protected fields like email, company, role, status are strictly blocked.
 */
router.patch('/', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const input = updateProfileSchema.parse(req.body);
      const userId = req.user!.sub;

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) {
        updateData.name = input.name;
        // Also split name into firstName/lastName if present
        const parts = input.name.trim().split(/\s+/);
        if (parts.length > 0 && parts[0]) {
          updateData.firstName = parts[0];
          updateData.lastName = parts.slice(1).join(' ') || parts[0];
        }
      }
      if (input.bio !== undefined) {
        updateData.bio = input.bio;
      }
      if (input.profilePicture !== undefined) {
        updateData.profilePicture = input.profilePicture;
        updateData.avatarUrl = input.profilePicture;
      }
      if (input.avatarUrl !== undefined && input.profilePicture === undefined) {
        updateData.avatarUrl = input.avatarUrl;
        updateData.profilePicture = input.avatarUrl;
      }

      const updatedUser = await userRepository.updateById(userId, updateData);
      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      const sanitized = updatedUser.toJSON() as Record<string, unknown>;
      delete sanitized.passwordHash;

      res.status(200).json(successResponse({ user: sanitized }));
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * PATCH /api/profile/password (or /api/v1/profile/password)
 * Updates the user's password verifying their current password first.
 */
router.patch('/password', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const input = changePasswordSchema.parse(req.body);
      await changePassword(req.user!.sub, input);
      res.status(200).json(successResponse({ message: 'Password updated successfully' }));
    } catch (err) {
      next(err);
    }
  })();
});

export { router as profileRouter };
