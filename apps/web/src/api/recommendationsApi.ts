import type { Product } from '@airbus-tools/shared';
import { apiClient } from './profileApi';

// ── Response shapes ───────────────────────────────────────────────────────────

export interface RecommendationsMeta {
  limit: number;
  hasNextPage: boolean;
  nextCursor?: string;
}

export interface RecommendationsResponse {
  products: Product[];
  meta: RecommendationsMeta;
}

export type InteractionEventType = 'viewed' | 'contacted' | 'requested' | 'ordered';

// ── API calls ─────────────────────────────────────────────────────────────────

export const recommendationsApi = {
  /**
   * GET /api/recommendations
   * Returns a page of ranked, unseen products for the current user.
   */
  list: async (params: { cursor?: string; limit?: number } = {}): Promise<RecommendationsResponse> => {
    const query: Record<string, string> = {};
    if (params.cursor) query.cursor = params.cursor;
    if (params.limit !== undefined) query.limit = String(params.limit);

    const res = await apiClient.get<{
      success: boolean;
      data: { products: Product[] };
      meta: RecommendationsMeta;
    }>('/recommendations', { params: query });

    return {
      products: res.data.data.products,
      meta: res.data.meta ?? { limit: params.limit ?? 20, hasNextPage: false },
    };
  },

  /**
   * POST /api/recommendations/interactions
   * Records a user interaction event.
   */
  recordInteraction: async (type: InteractionEventType, entityId: string): Promise<void> => {
    await apiClient.post('/recommendations/interactions', { type, entityId });
  },
};
