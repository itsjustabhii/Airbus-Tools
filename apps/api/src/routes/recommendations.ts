import { Router as createRouter } from 'express';
import type { Router, Request, Response, NextFunction } from 'express';

import type { ApiMeta } from '@airbus-tools/shared';

import { successResponse } from '../core/response';
import { authenticate } from '../middlewares/authenticate';
import { interactionService } from '../services/interactionService';
import { recommendationService } from '../services/recommendationService';

import {
  getRecommendationsQuerySchema,
  recordInteractionBodySchema,
} from './recommendations.schemas';

const router: Router = createRouter();

// ── GET /api/recommendations ──────────────────────────────────────────────────
/**
 * Returns a cursor-paginated, ranked list of products the caller has NOT
 * previously interacted with.
 *
 * - Authenticated callers: personal interaction history drives $nin exclusion.
 * - Unauthenticated callers: no exclusion — purely popularity/recency ranked.
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const query = getRecommendationsQuerySchema.parse(req.query);

      const userId = req.user?.sub;

      const result = await recommendationService.getRecommendations({
        ...(userId !== undefined && { userId }),
        ...(query.cursor !== undefined && { cursor: query.cursor }),
        limit: query.limit,
      });

      const meta: ApiMeta = {
        limit: result.limit,
        hasNextPage: result.hasNextPage,
      };
      if (result.nextCursor !== null) meta.nextCursor = result.nextCursor;

      res.status(200).json(
        successResponse(
          { products: result.items.map((p) => p.toJSON()) },
          meta,
        ),
      );
    } catch (err) {
      next(err);
    }
  })();
});

// ── POST /api/interactions ────────────────────────────────────────────────────
/**
 * Records a user interaction (viewed / contacted / requested / ordered).
 * Requires authentication so interactions are tied to the user's history.
 */
router.post('/interactions', authenticate, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const body = recordInteractionBodySchema.parse(req.body);
      const userId = req.user!.sub;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const opts = {
        userId,
        ...(ipAddress !== undefined && { ipAddress }),
        ...(userAgent !== undefined && { userAgent }),
      };

      let interaction;
      switch (body.type) {
        case 'viewed':
          interaction = await interactionService.recordViewed(body.entityId, opts);
          break;
        case 'contacted':
          interaction = await interactionService.recordContacted(body.entityId, opts);
          break;
        case 'requested':
          interaction = await interactionService.recordRequested(body.entityId, opts);
          break;
        case 'ordered':
          interaction = await interactionService.recordOrdered(body.entityId, opts);
          break;
      }

      res.status(201).json(successResponse({ interaction: interaction.toJSON() }));
    } catch (err) {
      next(err);
    }
  })();
});

export { router as recommendationsRouter };
