"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendationService = exports.RecommendationService = exports.RANKING_SIGNALS = exports.deliverySignal = exports.stockSignal = exports.recencySignal = exports.popularitySignal = void 0;
exports.computeScore = computeScore;
const shared_1 = require("@airbus-tools/shared");
const mongoose_1 = __importDefault(require("mongoose"));
const InteractionRepository_1 = require("../database/repositories/InteractionRepository");
const ProductRepository_1 = require("../database/repositories/ProductRepository");
const interactionService_1 = require("./interactionService");
/**
 * Popularity signal — scales linearly with global view count.
 * Weight: 1.0 per view (normalised to max 50 pts to avoid overshadowing recency).
 */
const popularitySignal = (doc, ctx) => {
    const views = ctx.viewCounts.get(doc._id.toString()) ?? 0;
    return Math.min(views, 50);
};
exports.popularitySignal = popularitySignal;
/**
 * Recency signal — products listed in the last 7 days get a boost.
 * Weight: up to 30 pts decaying linearly over 7 days.
 */
const recencySignal = (doc, ctx) => {
    const ageMs = ctx.nowMs - doc.createdAt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (ageMs >= sevenDaysMs)
        return 0;
    return 30 * (1 - ageMs / sevenDaysMs);
};
exports.recencySignal = recencySignal;
/**
 * Stock availability signal — prefer products with more stock.
 * Weight: up to 20 pts (capped at qty 100).
 */
const stockSignal = (doc, _ctx) => {
    return Math.min(doc.quantityAvailable, 100) / 5;
};
exports.stockSignal = stockSignal;
/**
 * Fast-delivery signal — products that ship within 7 days score higher.
 * Weight: up to 15 pts.
 */
const deliverySignal = (doc, _ctx) => {
    if (!doc.estimatedDeliveryDays)
        return 0;
    if (doc.estimatedDeliveryDays <= 7)
        return 15;
    if (doc.estimatedDeliveryDays <= 14)
        return 8;
    return 0;
};
exports.deliverySignal = deliverySignal;
/**
 * The active set of ranking signals.
 * Extend this array to add new signals without touching any other code.
 */
exports.RANKING_SIGNALS = [
    exports.popularitySignal,
    exports.recencySignal,
    exports.stockSignal,
    exports.deliverySignal,
];
function computeScore(doc, ctx, signals = exports.RANKING_SIGNALS) {
    return signals.reduce((total, signal) => total + signal(doc, ctx), 0);
}
// ── Service ───────────────────────────────────────────────────────────────────
class RecommendationService {
    /**
     * Fetch a cursor-paginated, ranked page of product recommendations.
     *
     * Cursor encoding: base64url JSON `{ id: string }` pointing at the last
     * item's Mongo _id.  We sort the ranked candidates in-memory then slice —
     * this is intentional for Phase 5 (small-to-medium catalogs); a future phase
     * can push ranking into an aggregation pipeline or separate scoring store.
     */
    async getRecommendations(opts = {}) {
        const limit = Math.max(1, Math.min(50, opts.limit ?? 20));
        // ── 1. Resolve already-interacted product IDs for this user ────────────
        const excludedIds = opts.userId
            ? await interactionService_1.interactionService.getInteractedProductIds(opts.userId)
            : [];
        // ── 2. Build $nin exclusion filter ─────────────────────────────────────
        //    entityId is stored as a plain string, but Product._id is ObjectId —
        //    convert valid hex strings so the $nin comparison works correctly.
        const excludedOids = excludedIds
            .filter((id) => mongoose_1.default.isValidObjectId(id))
            .map((id) => new mongoose_1.default.Types.ObjectId(id));
        const filter = {
            status: shared_1.ProductStatus.ACTIVE,
            quantityAvailable: { $gt: 0 },
            ...(excludedOids.length > 0 && { _id: { $nin: excludedOids } }),
        };
        // ── 3. Fetch all eligible candidates (up to 500 for in-memory ranking) ─
        //    In a large catalog a future phase would push this into a pipeline.
        const CANDIDATE_CAP = 500;
        const candidates = await ProductRepository_1.productRepository.find(filter, undefined, {
            limit: CANDIDATE_CAP,
            sort: { createdAt: -1 },
        });
        if (candidates.length === 0) {
            return { items: [], nextCursor: null, hasNextPage: false, limit };
        }
        // ── 4. Fetch view counts and build ranking context ─────────────────────
        const candidateIds = candidates.map((c) => c._id.toString());
        const rawViewCounts = await InteractionRepository_1.interactionRepository.getProductViewCounts(candidateIds);
        const viewCounts = new Map(rawViewCounts.map((r) => [r._id, r.count]));
        const ctx = { viewCounts, nowMs: Date.now() };
        // ── 5. Rank + stable-sort (desc score, then asc _id for tie-breaking) ──
        const scored = candidates
            .map((doc) => ({ doc, score: computeScore(doc, ctx) }))
            .sort((a, b) => {
            if (b.score !== a.score)
                return b.score - a.score;
            return a.doc._id.toString() < b.doc._id.toString() ? -1 : 1;
        });
        // ── 6. Cursor-based slicing ────────────────────────────────────────────
        let startIndex = 0;
        if (opts.cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(opts.cursor, 'base64url').toString('utf8'));
                const idx = scored.findIndex((s) => s.doc._id.toString() === decoded.id);
                if (idx !== -1)
                    startIndex = idx + 1;
            }
            catch {
                // Malformed cursor — start from beginning
            }
        }
        const page = scored.slice(startIndex, startIndex + limit + 1);
        const hasNextPage = page.length > limit;
        const pageItems = hasNextPage ? page.slice(0, limit) : page;
        const lastItem = pageItems[pageItems.length - 1];
        const nextCursor = hasNextPage && lastItem
            ? Buffer.from(JSON.stringify({ id: lastItem.doc._id.toString() }), 'utf8').toString('base64url')
            : null;
        return {
            items: pageItems.map((s) => s.doc),
            nextCursor,
            hasNextPage,
            limit,
        };
    }
}
exports.RecommendationService = RecommendationService;
exports.recommendationService = new RecommendationService();
//# sourceMappingURL=recommendationService.js.map