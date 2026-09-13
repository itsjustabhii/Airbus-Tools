import { useState, useEffect, useRef, useCallback } from 'react';
import type { Product } from '@airbus-tools/shared';
import { recommendationsApi } from '../api/recommendationsApi';

export type FeedStatus = 'idle' | 'loading' | 'error' | 'end';

export interface UseInfiniteRecommendationsResult {
  products: Product[];
  status: FeedStatus;
  error: string | null;
  /** Attach this ref to the sentinel element at the bottom of the list */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Manually retry after an error */
  retry: () => void;
}

/**
 * useInfiniteRecommendations
 *
 * Manages an infinite-scroll feed of product recommendations:
 *
 *  - Uses IntersectionObserver to load the next page when the sentinel
 *    div enters the viewport.
 *  - Cursor pagination: each page response carries an opaque nextCursor.
 *  - Request deduplication: an in-flight flag prevents concurrent fetches
 *    triggered by rapid intersection callbacks.
 *  - Duplicate product guard: a Set<string> tracks seen product IDs so
 *    a product is never rendered twice even if cursors overlap.
 *  - Exposes `status` so the component can render loading/error/empty/end states.
 */
export function useInfiniteRecommendations(limit = 20): UseInfiniteRecommendationsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<FeedStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Cursor state (null = first page; undefined = no more pages)
  const nextCursorRef = useRef<string | null>(null);
  const hasNextPageRef = useRef<boolean>(true);

  // In-flight flag for deduplication
  const fetchingRef = useRef<boolean>(false);

  // Seen IDs guard
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Sentinel DOM element for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchNextPage = useCallback(async () => {
    // Deduplication: skip if already fetching or no more pages
    if (fetchingRef.current || !hasNextPageRef.current) return;

    fetchingRef.current = true;
    setStatus('loading');
    setError(null);

    try {
      const response = await recommendationsApi.list({
        ...(nextCursorRef.current ? { cursor: nextCursorRef.current } : {}),
        limit,
      });

      // Deduplicate products
      const newProducts = response.products.filter((p) => {
        if (seenIdsRef.current.has(p.id)) return false;
        seenIdsRef.current.add(p.id);
        return true;
      });

      setProducts((prev) => [...prev, ...newProducts]);

      nextCursorRef.current = response.meta.nextCursor ?? null;
      hasNextPageRef.current = response.meta.hasNextPage;

      setStatus(response.meta.hasNextPage ? 'idle' : 'end');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? (err instanceof Error ? err.message : 'Failed to load recommendations');
      setError(msg);
      setStatus('error');
    } finally {
      fetchingRef.current = false;
    }
  }, [limit]);

  // ── IntersectionObserver ─────────────────────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage]);

  // ── Kick off first page on mount ────────────────────────────────────────
  useEffect(() => {
    void fetchNextPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = useCallback(() => {
    setStatus('idle');
    setError(null);
    hasNextPageRef.current = true;
    void fetchNextPage();
  }, [fetchNextPage]);

  return { products, status, error, sentinelRef, retry };
}
