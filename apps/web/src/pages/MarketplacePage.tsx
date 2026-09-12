import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ProductCategory, ProductCondition } from '@airbus-tools/shared';
import type { Product } from '@airbus-tools/shared';
import { productsApi, type ListProductsParams, type ProductsListMeta } from '../api/productsApi';

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

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  OVERHAULED: 'Overhauled',
  SERVICEABLE: 'Serviceable',
  AS_REMOVED: 'As Removed',
  MODIFIED: 'Modified',
};

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={`/marketplace/${product.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
      data-testid="product-card"
    >
      {/* Thumbnail */}
      <div className="mb-4 h-40 w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        {product.mediaUrls.length > 0 ? (
          <img
            src={product.mediaUrls[0]}
            alt={product.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          </svg>
        )}
      </div>

      {/* Category badge */}
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
          {CATEGORY_LABELS[product.category] ?? product.category}
        </span>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {CONDITION_LABELS[product.condition] ?? product.condition}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">
        {product.title}
      </h3>
      <p className="text-xs text-gray-500 mb-3 font-mono">P/N: {product.partNumber}</p>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">
            {formatCurrency(product.price, product.currency)}
          </p>
          <p className="text-xs text-gray-400">
            Min. qty: {product.minimumOrderQuantity} · Stock: {product.quantityAvailable}
          </p>
        </div>
        {product.estimatedDeliveryDays && (
          <span className="text-xs text-gray-500">
            ~{product.estimatedDeliveryDays}d delivery
          </span>
        )}
      </div>
    </Link>
  );
}

export function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<ProductsListMeta>({ limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'createdAt' | 'title'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchProducts = useCallback(
    async (cursor?: string, direction?: 'next' | 'prev') => {
      setLoading(true);
      setError(null);
      try {
        const params: ListProductsParams = {
          limit: 20,
          sortBy,
          sortOrder,
        };
        if (cursor !== undefined) params.cursor = cursor;
        if (direction !== undefined) params.direction = direction;
        if (search.trim()) params.search = search.trim();
        if (category) params.category = category as ProductCategory;
        if (condition) params.condition = condition as ProductCondition;
        if (minPrice) params.minPrice = parseFloat(minPrice);
        if (maxPrice) params.maxPrice = parseFloat(maxPrice);

        const result = await productsApi.list(params);
        setProducts(result.products);
        setMeta(result.meta);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message ??
          (err instanceof Error ? err.message : 'Failed to load products');
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [search, category, condition, minPrice, maxPrice, sortBy, sortOrder],
  );

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchProducts();
  };

  const handleReset = () => {
    setSearch('');
    setCategory('');
    setCondition('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
            <p className="text-sm text-gray-500">Browse aerospace parts and components</p>
          </div>
          <Link
            to="/"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Home
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <form
          onSubmit={handleSearch}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label htmlFor="search" className="sr-only">Search</label>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, description, tags..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="sr-only">Category</label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {Object.values(ProductCategory).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </div>

            {/* Condition */}
            <div>
              <label htmlFor="condition" className="sr-only">Condition</label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Conditions</option>
                {Object.values(ProductCondition).map((c) => (
                  <option key={c} value={c}>
                    {CONDITION_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </div>

            {/* Price range */}
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min price"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max price"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Sort */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'price' | 'createdAt' | 'title')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="createdAt">Newest</option>
                <option value="price">Price</option>
                <option value="title">Title</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Reset filters
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Search
            </button>
          </div>
        </form>

        {/* Content */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="h-6 w-6 animate-spin mr-3 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading products...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-lg font-medium">No products found</p>
            <p className="text-sm">Try adjusting your search filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Cursor pagination controls */}
        {!loading && (meta.hasPrevPage || meta.hasNextPage) && (
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => void fetchProducts(meta.prevCursor, 'prev')}
              disabled={!meta.hasPrevPage || !meta.prevCursor}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => void fetchProducts(meta.nextCursor, 'next')}
              disabled={!meta.hasNextPage || !meta.nextCursor}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
