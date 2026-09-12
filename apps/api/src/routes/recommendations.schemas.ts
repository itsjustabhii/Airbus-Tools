import { z } from 'zod';

// ── GET /api/recommendations ──────────────────────────────────────────────────
export const getRecommendationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type GetRecommendationsQuery = z.infer<typeof getRecommendationsQuerySchema>;

// ── POST /api/interactions ─────────────────────────────────────────────────────
export const recordInteractionBodySchema = z.object({
  type: z.enum(['viewed', 'contacted', 'requested', 'ordered']),
  /** Product ID for viewed / contacted / requested; Order ID for ordered */
  entityId: z.string().min(1, 'entityId is required'),
});

export type RecordInteractionBody = z.infer<typeof recordInteractionBodySchema>;
