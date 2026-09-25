import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { recommendationsApi } from '../api/recommendationsApi';
import { RecommendationFeed } from '../components/RecommendationFeed';

// ── Mock the API module ───────────────────────────────────────────────────────

vi.mock('../api/recommendationsApi', () => ({
  recommendationsApi: {
    list: vi.fn(),
    recordInteraction: vi.fn(),
  },
}));

// ── IntersectionObserver mock ─────────────────────────────────────────────────

type IOCallback = (entries: IntersectionObserverEntry[]) => void;
let ioCallback: IOCallback | null = null;

const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

function triggerIntersection(isIntersecting: boolean) {
  ioCallback?.([{ isIntersecting } as IntersectionObserverEntry]);
}

beforeEach(() => {
  ioCallback = null;
  mockObserve.mockClear();
  mockDisconnect.mockClear();

  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn((cb: IOCallback) => {
      ioCallback = cb;
      return {
        observe: mockObserve,
        disconnect: mockDisconnect,
      };
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(id: string) {
  return {
    id,
    title: `Product ${id}`,
    partNumber: `PN-${id}`,
    description: 'A part',
    category: 'FASTENERS' as const,
    condition: 'NEW' as const,
    status: 'ACTIVE' as const,
    price: 100,
    currency: 'USD',
    quantityAvailable: 10,
    minimumOrderQuantity: 1,
    certifications: [],
    tags: [],
    mediaUrls: [],
    sellerId: 'seller-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function renderFeed(limit = 20) {
  return render(
    <MemoryRouter>
      <RecommendationFeed limit={limit} />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecommendationFeed', () => {
  describe('Loading state', () => {
    it('shows skeleton cards while the first page is loading', async () => {
      vi.mocked(recommendationsApi.list).mockReturnValue(new Promise(() => {})); // never resolves
      renderFeed();

      await waitFor(() => {
        expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
      });
      expect(screen.getAllByTestId('skeleton-card').length).toBeGreaterThan(0);
    });
  });

  describe('Empty state', () => {
    it('renders the empty-state message when no products are returned', async () => {
      vi.mocked(recommendationsApi.list).mockResolvedValue({
        products: [],
        meta: { limit: 20, hasNextPage: false },
      });

      renderFeed();

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText(/No recommendations yet/i)).toBeInTheDocument();
    });
  });

  describe('Error state + retry', () => {
    it('renders the error banner when the API call fails', async () => {
      vi.mocked(recommendationsApi.list).mockRejectedValueOnce(new Error('Network failure'));

      renderFeed();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('Network failure')).toBeInTheDocument();
    });

    it('retries and loads products after clicking Retry', async () => {
      vi.mocked(recommendationsApi.list)
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({
          products: [makeProduct('p1')],
          meta: { limit: 20, hasNextPage: false },
        });

      renderFeed();

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('retry-button'));

      await waitFor(() => {
        expect(screen.getByTestId('recommendation-card')).toBeInTheDocument();
      });
      expect(screen.getAllByTestId('recommendation-card')).toHaveLength(1);
    });
  });

  describe('Successful load', () => {
    it('renders product cards for all returned products', async () => {
      vi.mocked(recommendationsApi.list).mockResolvedValue({
        products: [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')],
        meta: { limit: 20, hasNextPage: false },
      });

      renderFeed();

      await waitFor(() => {
        expect(screen.getAllByTestId('recommendation-card')).toHaveLength(3);
      });
    });

    it('renders end-of-results when hasNextPage is false', async () => {
      vi.mocked(recommendationsApi.list).mockResolvedValue({
        products: [makeProduct('p1')],
        meta: { limit: 20, hasNextPage: false },
      });

      renderFeed();

      await waitFor(() => {
        expect(screen.getByTestId('end-of-results')).toBeInTheDocument();
      });
    });
  });

  describe('Infinite scroll', () => {
    it('loads the next page when the sentinel enters the viewport', async () => {
      vi.mocked(recommendationsApi.list)
        .mockResolvedValueOnce({
          products: [makeProduct('p1'), makeProduct('p2')],
          meta: { limit: 2, hasNextPage: true, nextCursor: 'cursor-abc' },
        })
        .mockResolvedValueOnce({
          products: [makeProduct('p3'), makeProduct('p4')],
          meta: { limit: 2, hasNextPage: false },
        });

      renderFeed(2);

      // Wait for first page
      await waitFor(() => {
        expect(screen.getAllByTestId('recommendation-card')).toHaveLength(2);
      });

      // Simulate sentinel entering viewport
      act(() => triggerIntersection(true));

      await waitFor(() => {
        expect(screen.getAllByTestId('recommendation-card')).toHaveLength(4);
      });

      // End-of-results should now show
      expect(screen.getByTestId('end-of-results')).toBeInTheDocument();
    });

    it('passes the nextCursor from page 1 to the page 2 request', async () => {
      vi.mocked(recommendationsApi.list)
        .mockResolvedValueOnce({
          products: [makeProduct('a1')],
          meta: { limit: 1, hasNextPage: true, nextCursor: 'CURSOR_XYZ' },
        })
        .mockResolvedValueOnce({
          products: [makeProduct('a2')],
          meta: { limit: 1, hasNextPage: false },
        });

      renderFeed(1);

      await waitFor(() => {
        expect(screen.getAllByTestId('recommendation-card')).toHaveLength(1);
      });

      act(() => triggerIntersection(true));

      await waitFor(() => {
        expect(screen.getAllByTestId('recommendation-card')).toHaveLength(2);
      });

      expect(vi.mocked(recommendationsApi.list)).toHaveBeenNthCalledWith(2, {
        cursor: 'CURSOR_XYZ',
        limit: 1,
      });
    });

    it('does not trigger a second fetch while one is already in-flight (deduplication)', async () => {
      let resolveFirst!: (v: Awaited<ReturnType<typeof recommendationsApi.list>>) => void;
      const firstPromise = new Promise<Awaited<ReturnType<typeof recommendationsApi.list>>>(
        (r) => (resolveFirst = r),
      );
      vi.mocked(recommendationsApi.list).mockReturnValueOnce(firstPromise);

      renderFeed();

      // Trigger intersection twice before the first fetch resolves
      act(() => triggerIntersection(true));
      act(() => triggerIntersection(true));

      // Resolve the first (and only) in-flight request
      act(() => {
        resolveFirst({
          products: [makeProduct('b1')],
          meta: { limit: 20, hasNextPage: false },
        });
      });

      await waitFor(() => {
        expect(screen.getAllByTestId('recommendation-card')).toHaveLength(1);
      });

      // list was called exactly once for the initial load + zero extra
      // (the two intersection triggers during loading were both deduped)
      expect(vi.mocked(recommendationsApi.list)).toHaveBeenCalledTimes(1);
    });

    it('does not render duplicate products across pages', async () => {
      // Page 2 accidentally returns the same product as page 1 (cursor regression)
      vi.mocked(recommendationsApi.list)
        .mockResolvedValueOnce({
          products: [makeProduct('dup-1'), makeProduct('dup-2')],
          meta: { limit: 2, hasNextPage: true, nextCursor: 'cur' },
        })
        .mockResolvedValueOnce({
          products: [makeProduct('dup-2'), makeProduct('dup-3')], // dup-2 duplicated
          meta: { limit: 2, hasNextPage: false },
        });

      renderFeed(2);

      await waitFor(() => {
        expect(screen.getAllByTestId('recommendation-card')).toHaveLength(2);
      });

      act(() => triggerIntersection(true));

      await waitFor(() => {
        // Only 3 unique products should appear, not 4
        expect(screen.getAllByTestId('recommendation-card')).toHaveLength(3);
      });
    });

    it('does not fetch when hasNextPage is false', async () => {
      vi.mocked(recommendationsApi.list).mockResolvedValueOnce({
        products: [makeProduct('z1')],
        meta: { limit: 20, hasNextPage: false },
      });

      renderFeed();

      await waitFor(() => {
        expect(screen.getByTestId('end-of-results')).toBeInTheDocument();
      });

      act(() => triggerIntersection(true));

      // Still only 1 call — no additional fetch after end of results
      expect(vi.mocked(recommendationsApi.list)).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sentinel observer lifecycle', () => {
    it('attaches IntersectionObserver to the sentinel element', async () => {
      vi.mocked(recommendationsApi.list).mockResolvedValue({
        products: [],
        meta: { limit: 20, hasNextPage: false },
      });

      renderFeed();

      await waitFor(() => {
        expect(mockObserve).toHaveBeenCalled();
      });

      const observedEl = mockObserve.mock.calls[0]?.[0];
      expect(observedEl).toBeDefined();
    });
  });
});
