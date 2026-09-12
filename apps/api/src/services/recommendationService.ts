import mongoose from 'mongoose';

/**
 * RecommendationService
 *
 * Algorithm (v1 — expandable ranking signals):
 *
 *   1. Resolve the set of product IDs the user has already interacted with.
 *   2. Query MongoDB for ACTIVE products with quantityAvailable > 0 and
 *      entityId $nin the interacted set.
 *   3. Fetch global view-counts for those candidate product IDs so we can
 *      rank by popularity.
 *   4. Apply ranking: each RankingSignal is a pure function that accepts a
 *      candidate doc + context and returns a numeric score contribution.
 *      Signals are summed and candidates are sorted descending.
 *   5. Return cursor-paginated results so the feed can infinitely scroll.
 *
 * Adding a new signal is one addition to the RANKING_SIGNALS array —
 * no other code needs to change.
 */

import { ProductStatus } from '@airbus-tools/shared';
import type { FilterQuery } from 'mongoose';

import type { IProductDocument } from '../database/models/Product';
import { productRepository } from '../database/repositories/ProductRepository';
import { interactionRepository } from '../database/repositories/InteractionRepository';
import { interactionService } from './interactionService';

// ── Ranking signal infrastructure ─────────────────────────────────────────────

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
export const popularitySignal: RankingSignal = (doc, ctx) => {
  const views = ctx.viewCounts.get(doc._id.toString()) ?? 0;
  return Math.min(views, 50);
};

/**
 * Recency signal — products listed in the last 7 days get a boost.
 * Weight: up to 30 pts decaying linearly over 7 days.
 */
export const recencySignal: RankingSignal = (doc, ctx) => {
  const ageMs = ctx.nowMs - doc.createdAt.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (ageMs >= sevenDaysMs) return 0;
  return 30 * (1 - ageMs / sevenDaysMs);
};

/**
 * Stock availability signal — prefer products with more stock.
 * Weight: up to 20 pts (capped at qty 100).
 */
export const stockSignal: RankingSignal = (doc, _ctx) => {
  return Math.min(doc.quantityAvailable, 100) / 5;
};

/**
 * Fast-delivery signal — products that ship within 7 days score higher.
 * Weight: up to 15 pts.
 */
export const deliverySignal: RankingSignal = (doc, _ctx) => {
  if (!doc.estimatedDeliveryDays) return 0;
  if (doc.estimatedDeliveryDays <= 7) return 15;
  if (doc.estimatedDeliveryDays <= 14) return 8;
  return 0;
};

/**
 * The active set of ranking signals.
 * Extend this array to add new signals without touching any other code.
 */
export const RANKING_SIGNALS: RankingSignal[] = [
  popularitySignal,
  recencySignal,
  stockSignal,
  deliverySignal,
];

export function computeScore(doc: IProductDocument, ctx: RankingContext, signals = RANKING_SIGNALS): number {
  return signals.reduce((total, signal) => total + signal(doc, ctx), 0);
}

// ── Pagination ────────────────────────────────────────────────────────────────

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

// ── Service ───────────────────────────────────────────────────────────────────

export class RecommendationService {
  /**
   * Fetch a cursor-paginated, ranked page of product recommendations.
   *
   * Cursor encoding: base64url JSON `{ id: string }` pointing at the last
   * item's Mongo _id.  We sort the ranked candidates in-memory then slice —
   * this is intentional for Phase 5 (small-to-medium catalogs); a future phase
   * can push ranking into an aggregation pipeline or separate scoring store.
   */
  async getRecommendations(opts: GetRecommendationsOptions = {}): Promise<RecommendationPage> {
    const limit = Math.max(1, Math.min(50, opts.limit ?? 20));

    // ── 1. Resolve already-interacted product IDs for this user ────────────
    const excludedIds: string[] = opts.userId
      ? await interactionService.getInteractedProductIds(opts.userId)
      : [];

    // ── 2. Build $nin exclusion filter ─────────────────────────────────────
    //    entityId is stored as a plain string, but Product._id is ObjectId —
    //    convert valid hex strings so the $nin comparison works correctly.
    const excludedOids = excludedIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const filter: FilterQuery<IProductDocument> = {
      status: ProductStatus.ACTIVE,
      quantityAvailable: { $gt: 0 },
      ...(excludedOids.length > 0 && { _id: { $nin: excludedOids } }),
    };

    // ── 3. Fetch all eligible candidates (up to 500 for in-memory ranking) ─
    //    In a large catalog a future phase would push this into a pipeline.
    const CANDIDATE_CAP = 500;
    const candidates = await productRepository.find(filter, undefined, {
      limit: CANDIDATE_CAP,
      sort: { createdAt: -1 },
    });

    if (candidates.length === 0) {
      return { items: [], nextCursor: null, hasNextPage: false, limit };
    }

    // ── 4. Fetch view counts and build ranking context ─────────────────────
    const candidateIds = candidates.map((c) => c._id.toString());
    const rawViewCounts = await interactionRepository.getProductViewCounts(candidateIds);
    const viewCounts = new Map<string, number>(rawViewCounts.map((r) => [r._id, r.count]));
    const ctx: RankingContext = { viewCounts, nowMs: Date.now() };

    // ── 5. Rank + stable-sort (desc score, then asc _id for tie-breaking) ──
    const scored = candidates
      .map((doc) => ({ doc, score: computeScore(doc, ctx) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.doc._id.toString() < b.doc._id.toString() ? -1 : 1;
      });

    // ── 6. Cursor-based slicing ────────────────────────────────────────────
    let startIndex = 0;
    if (opts.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(opts.cursor, 'base64url').toString('utf8')) as { id: string };
        const idx = scored.findIndex((s) => s.doc._id.toString() === decoded.id);
        if (idx !== -1) startIndex = idx + 1;
      } catch {
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

export const recommendationService = new RecommendationService();
