import type { Product } from '@airbus-tools/shared';
import { Link } from 'react-router-dom';

import { recommendationsApi } from '../api/recommendationsApi';
import { useInfiniteRecommendations } from '../hooks/useInfiniteRecommendations';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  FASTENERS: 'Fasteners',
  AVIONICS: 'Avionics',
  AIRFRAME: 'Airframe',
  PROPULSION: 'Propulsion',
  CABIN_INTERIORS: 'Cabin Interiors',
  TOOLING_AND_EQUIPMENT: 'Tooling & Equipment',
  RAW_MATERIALS: 'Raw Materials',
  HYDRAULICS: 'Hydraulics',
  MAINTENANCE_SERVICES: 'Maintenance Services',
  OTHER: 'Other',
};

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

// ── Single card ───────────────────────────────────────────────────────────────

function RecommendedProductCard({ product }: { product: Product }) {
  const handleView = () => {
    void recommendationsApi.recordInteraction('viewed', product.id);
  };

  return (
    <Link
      to={`/marketplace/${product.id}`}
      onClick={handleView}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
      data-testid="recommendation-card"
    >
      {/* Thumbnail */}
      <div className="mb-4 h-36 w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        {product.mediaUrls.length > 0 ? (
          <img
            src={product.mediaUrls[0]}
            alt={product.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          </svg>
        )}
      </div>

      {/* Badges */}
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-100">
          {CATEGORY_LABELS[product.category] ?? product.category}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">
        {product.title}
      </h3>
      <p className="text-xs text-gray-500 mb-3 font-mono">P/N: {product.partNumber}</p>

      <div className="flex items-end justify-between">
        <p className="text-base font-bold text-gray-900">
          {formatCurrency(product.price, product.currency)}
        </p>
        {product.estimatedDeliveryDays && (
          <span className="text-xs text-gray-400">~{product.estimatedDeliveryDays}d delivery</span>
        )}
      </div>
    </Link>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 animate-pulse" data-testid="skeleton-card">
      <div className="mb-4 h-36 w-full rounded-lg bg-gray-200" />
      <div className="mb-2 h-4 w-20 rounded bg-gray-200" />
      <div className="mb-1 h-4 w-full rounded bg-gray-200" />
      <div className="mb-3 h-3 w-24 rounded bg-gray-200" />
      <div className="h-4 w-16 rounded bg-gray-200" />
    </div>
  );
}

// ── Feed component ────────────────────────────────────────────────────────────

export interface RecommendationFeedProps {
  limit?: number;
}

/**
 * RecommendationFeed
 *
 * Infinite-scroll feed of product recommendations.
 * Attaches an IntersectionObserver sentinel at the bottom so the next page
 * loads automatically as the user scrolls toward the end.
 *
 * States handled: loading (skeleton), error (message + retry), empty, end-of-results.
 */
export function RecommendationFeed({ limit = 20 }: RecommendationFeedProps) {
  const { products, status, error, sentinelRef, retry } = useInfiniteRecommendations(limit);

  const isEmpty = products.length === 0 && status !== 'loading';

  return (
    <section aria-label="Recommended products" data-testid="recommendation-feed">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommended for you</h2>

      {/* Product grid */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <RecommendedProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* Skeleton loading rows */}
      {status === 'loading' && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4"
          data-testid="loading-skeleton"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && status !== 'error' && (
        <div
          className="flex flex-col items-center justify-center py-16 text-gray-400"
          data-testid="empty-state"
        >
          <svg className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-base font-medium">No recommendations yet</p>
          <p className="text-sm mt-1">Browse the marketplace to get personalised suggestions</p>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div
          className="my-4 rounded-md bg-red-50 border border-red-200 p-4 flex items-center justify-between"
          data-testid="error-state"
        >
          <p className="text-sm text-red-700">{error ?? 'Failed to load recommendations'}</p>
          <button
            onClick={retry}
            className="ml-4 text-sm font-medium text-red-700 underline hover:text-red-900"
            data-testid="retry-button"
          >
            Retry
          </button>
        </div>
      )}

      {/* End-of-results indicator */}
      {status === 'end' && products.length > 0 && (
        <p
          className="mt-6 text-center text-sm text-gray-400"
          data-testid="end-of-results"
        >
          You&apos;ve seen all recommendations
        </p>
      )}

      {/* IntersectionObserver sentinel — always rendered so the observer can attach */}
      <div ref={sentinelRef} aria-hidden="true" data-testid="scroll-sentinel" />
    </section>
  );
}
