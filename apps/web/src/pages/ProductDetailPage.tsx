import type { Product } from '@airbus-tools/shared';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

import { productsApi } from '../api/productsApi';

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

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    productsApi
      .getById(id)
      .then((p) => {
        setProduct(p);
        setSelectedImage(0);
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
            ?.error?.message ??
          (err instanceof Error ? err.message : 'Failed to load product');
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-3 text-gray-500">
          <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading product...</span>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-red-600">{error ?? 'Product not found'}</p>
          <Link to="/marketplace" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            ← Back to Marketplace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Breadcrumb nav */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <nav className="flex items-center space-x-2 text-sm text-gray-500">
            <Link to="/" className="hover:text-gray-700">Home</Link>
            <span>/</span>
            <Link to="/marketplace" className="hover:text-gray-700">Marketplace</Link>
            <span>/</span>
            <span className="text-gray-900 truncate max-w-xs">{product.title}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* ── Images ──────────────────────────────────────────────────────── */}
          <div>
            <div className="mb-3 h-80 w-full overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center">
              {product.mediaUrls.length > 0 ? (
                <img
                  src={product.mediaUrls[selectedImage] ?? product.mediaUrls[0]}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg className="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              )}
            </div>
            {product.mediaUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.mediaUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                      selectedImage === i ? 'border-blue-500' : 'border-transparent'
                    }`}
                  >
                    <img src={url} alt={`${product.title} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Details ─────────────────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Status + category badges */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-100">
                {CATEGORY_LABELS[product.category] ?? product.category}
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {CONDITION_LABELS[product.condition] ?? product.condition}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                product.status === 'ACTIVE'
                  ? 'bg-green-50 text-green-700 border-green-100'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-100'
              }`}>
                {product.status}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
              <p className="mt-1 text-sm font-mono text-gray-500">P/N: {product.partNumber}</p>
              {product.oemPartNumber && (
                <p className="text-xs font-mono text-gray-400">OEM P/N: {product.oemPartNumber}</p>
              )}
            </div>

            {/* Price */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(product.price, product.currency)}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Stock:</span> {product.quantityAvailable} units
                </div>
                <div>
                  <span className="font-medium">Min. order:</span> {product.minimumOrderQuantity} units
                </div>
                {product.estimatedDeliveryDays && (
                  <div className="col-span-2">
                    <span className="font-medium">Est. delivery:</span> {product.estimatedDeliveryDays} days
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Description</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">{product.description}</p>
            </div>

            {/* Certifications */}
            {product.certifications.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Certifications</h2>
                <div className="flex flex-wrap gap-1.5">
                  {product.certifications.map((cert) => (
                    <span key={cert} className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-100">
                      ✓ {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {product.tags.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Tags</h2>
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Physical properties */}
            {(product.dimensions || product.weightKg) && (
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Physical Specifications</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {product.weightKg && (
                    <>
                      <dt className="text-gray-500">Weight</dt>
                      <dd className="text-gray-900">{product.weightKg} kg</dd>
                    </>
                  )}
                  {product.dimensions && (
                    <>
                      <dt className="text-gray-500">Dimensions</dt>
                      <dd className="text-gray-900">
                        {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height} {product.dimensions.unit}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            )}

            <p className="text-xs text-gray-400">Listed on {formatDate(product.createdAt)}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
