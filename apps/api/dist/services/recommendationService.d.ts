import type { IProductDocument } from '../database/models/Product';
export interface RankingContext {
    /** view count per productId, pre-fetched from the DB */
    viewCounts: Map<string, number>;
    /** current wall-clock timestamp for recency calculations */
    nowMs: number;
}
export type RankingSignal = (doc: IProductDocument, ctx: RankingContext) => number;
/**
 * Popularity signal — scales linearly with global view count.
 * Weight: 1.0 per view (normalised to max 50 pts to avoid overshadowing recency).
 */
export declare const popularitySignal: RankingSignal;
/**
 * Recency signal — products listed in the last 7 days get a boost.
 * Weight: up to 30 pts decaying linearly over 7 days.
 */
export declare const recencySignal: RankingSignal;
/**
 * Stock availability signal — prefer products with more stock.
 * Weight: up to 20 pts (capped at qty 100).
 */
export declare const stockSignal: RankingSignal;
/**
 * Fast-delivery signal — products that ship within 7 days score higher.
 * Weight: up to 15 pts.
 */
export declare const deliverySignal: RankingSignal;
/**
 * The active set of ranking signals.
 * Extend this array to add new signals without touching any other code.
 */
export declare const RANKING_SIGNALS: RankingSignal[];
export declare function computeScore(doc: IProductDocument, ctx: RankingContext, signals?: RankingSignal[]): number;
export interface RecommendationPage {
    items: IProductDocument[];
    nextCursor: string | null;
    hasNextPage: boolean;
    limit: number;
}
export interface GetRecommendationsOptions {
    /** Authenticated user ID — drives interaction history exclusion. */
    userId?: string;
    /** Opaque cursor returned from a previous response. */
    cursor?: string;
    /** Page size; capped at 50. */
    limit?: number;
}
export declare class RecommendationService {
    /**
     * Fetch a cursor-paginated, ranked page of product recommendations.
     *
     * Cursor encoding: base64url JSON `{ id: string }` pointing at the last
     * item's Mongo _id.  We sort the ranked candidates in-memory then slice —
     * this is intentional for Phase 5 (small-to-medium catalogs); a future phase
     * can push ranking into an aggregation pipeline or separate scoring store.
     */
    getRecommendations(opts?: GetRecommendationsOptions): Promise<RecommendationPage>;
}
export declare const recommendationService: RecommendationService;
//# sourceMappingURL=recommendationService.d.ts.map