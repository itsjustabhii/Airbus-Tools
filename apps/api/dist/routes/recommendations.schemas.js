"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordInteractionBodySchema = exports.getRecommendationsQuerySchema = void 0;
const zod_1 = require("zod");
// ── GET /api/recommendations ──────────────────────────────────────────────────
exports.getRecommendationsQuerySchema = zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(20),
});
// ── POST /api/interactions ─────────────────────────────────────────────────────
exports.recordInteractionBodySchema = zod_1.z.object({
    type: zod_1.z.enum(['viewed', 'contacted', 'requested', 'ordered']),
    /** Product ID for viewed / contacted / requested; Order ID for ordered */
    entityId: zod_1.z.string().min(1, 'entityId is required'),
});
//# sourceMappingURL=recommendations.schemas.js.map