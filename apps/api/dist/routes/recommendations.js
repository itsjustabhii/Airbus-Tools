"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendationsRouter = void 0;
const express_1 = require("express");
const response_1 = require("../core/response");
const authenticate_1 = require("../middlewares/authenticate");
const interactionService_1 = require("../services/interactionService");
const recommendationService_1 = require("../services/recommendationService");
const recommendations_schemas_1 = require("./recommendations.schemas");
const router = (0, express_1.Router)();
exports.recommendationsRouter = router;
// ── GET /api/recommendations ──────────────────────────────────────────────────
/**
 * Returns a cursor-paginated, ranked list of products the caller has NOT
 * previously interacted with.
 *
 * - Authenticated callers: personal interaction history drives $nin exclusion.
 * - Unauthenticated callers: no exclusion — purely popularity/recency ranked.
 */
router.get('/', (req, res, next) => {
    void (async () => {
        try {
            const query = recommendations_schemas_1.getRecommendationsQuerySchema.parse(req.query);
            const userId = req.user?.sub;
            const result = await recommendationService_1.recommendationService.getRecommendations({
                ...(userId !== undefined && { userId }),
                ...(query.cursor !== undefined && { cursor: query.cursor }),
                limit: query.limit,
            });
            const meta = {
                limit: result.limit,
                hasNextPage: result.hasNextPage,
            };
            if (result.nextCursor !== null)
                meta.nextCursor = result.nextCursor;
            res.status(200).json((0, response_1.successResponse)({ products: result.items.map((p) => p.toJSON()) }, meta));
        }
        catch (err) {
            next(err);
        }
    })();
});
// ── POST /api/interactions ────────────────────────────────────────────────────
/**
 * Records a user interaction (viewed / contacted / requested / ordered).
 * Requires authentication so interactions are tied to the user's history.
 */
router.post('/interactions', authenticate_1.authenticate, (req, res, next) => {
    void (async () => {
        try {
            const body = recommendations_schemas_1.recordInteractionBodySchema.parse(req.body);
            const userId = req.user.sub;
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
                    interaction = await interactionService_1.interactionService.recordViewed(body.entityId, opts);
                    break;
                case 'contacted':
                    interaction = await interactionService_1.interactionService.recordContacted(body.entityId, opts);
                    break;
                case 'requested':
                    interaction = await interactionService_1.interactionService.recordRequested(body.entityId, opts);
                    break;
                case 'ordered':
                    interaction = await interactionService_1.interactionService.recordOrdered(body.entityId, opts);
                    break;
            }
            res.status(201).json((0, response_1.successResponse)({ interaction: interaction.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=recommendations.js.map