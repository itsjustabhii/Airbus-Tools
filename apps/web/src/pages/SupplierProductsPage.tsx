import type { Product } from '@airbus-tools/shared';
import { ProductCategory, ProductCondition, ProductStatus } from '@airbus-tools/shared';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

import {
  productsApi,
  type CreateProductPayload,
  type UpdateProductPayload,
} from '../api/productsApi';
import { profileApi } from '../api/profileApi';

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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  ACTIVE: 'bg-green-50 text-green-700 border-green-100',
  INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
  ARCHIVED: 'bg-red-50 text-red-700 border-red-100',
};

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

// ── Empty form state ──────────────────────────────────────────────────────────

const EMPTY_FORM: CreateProductPayload = {
  title: '',
  partNumber: '',
  oemPartNumber: '',
  description: '',
  category: ProductCategory.OTHER,
  condition: ProductCondition.NEW,
  status: ProductStatus.DRAFT,
  price: 0,
  currency: 'USD',
  quantityAvailable: 0,
  minimumOrderQuantity: 1,
  certifications: [],
  tags: [],
  mediaUrls: [],
};

// ── Sub-component: Product Form Modal ─────────────────────────────────────────

interface ProductFormModalProps {
  mode: 'create' | 'edit';
  initial?: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

function ProductFormModal({ mode, initial, onClose, onSaved }: ProductFormModalProps) {
  const [form, setForm] = useState<CreateProductPayload>(() => {
    if (mode === 'edit' && initial) {
      const editForm: CreateProductPayload = {
        title: initial.title,
        partNumber: initial.partNumber,
        oemPartNumber: initial.oemPartNumber ?? '',
        description: initial.description,
        category: initial.category,
        condition: initial.condition,
        status: initial.status,
        price: initial.price,
        currency: initial.currency,
        quantityAvailable: initial.quantityAvailable,
        minimumOrderQuantity: initial.minimumOrderQuantity,
        certifications: [...initial.certifications],
        tags: [...initial.tags],
        mediaUrls: [...initial.mediaUrls],
      };
      if (initial.estimatedDeliveryDays !== undefined) {
        editForm.estimatedDeliveryDays = initial.estimatedDeliveryDays;
      }
      return editForm;
    }
    return { ...EMPTY_FORM };
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tagsRaw, setTagsRaw] = useState(form.tags?.join(', ') ?? '');
  const [certsRaw, setCertsRaw] = useState(form.certifications?.join(', ') ?? '');
  const [mediaRaw, setMediaRaw] = useState(form.mediaUrls?.join('\n') ?? '');

  const setField = <K extends keyof CreateProductPayload>(key: K, value: CreateProductPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    const payload: CreateProductPayload = {
      ...form,
      tags: tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
      certifications: certsRaw.split(',').map((c) => c.trim()).filter(Boolean),
      mediaUrls: mediaRaw.split('\n').map((u) => u.trim()).filter(Boolean),
    };

    try {
      let saved: Product;
      if (mode === 'create') {
        saved = await productsApi.create(payload);
      } else {
        const update: UpdateProductPayload = { ...payload };
        saved = await productsApi.update(initial!.id, update);
      }
      onSaved(saved);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ??
        (err instanceof Error ? err.message : 'Failed to save product');
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? 'New Listing' : 'Edit Listing'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5">
          {formError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Title *</label>
            <input
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Titanium Structural Fastener Grade 5"
            />
          </div>

          {/* Part numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Part Number *</label>
              <input
                required
                maxLength={100}
                value={form.partNumber}
                onChange={(e) => setField('partNumber', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="ABC-12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">OEM Part Number</label>
              <input
                maxLength={100}
                value={form.oemPartNumber ?? ''}
                onChange={(e) => setField('oemPartNumber', e.target.value || undefined)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Description *</label>
            <textarea
              required
              rows={4}
              maxLength={5000}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Detailed description of the part, specifications, compliance, etc."
            />
          </div>

          {/* Category / Condition / Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value as ProductCategory)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.values(ProductCategory).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Condition *</label>
              <select
                value={form.condition}
                onChange={(e) => setField('condition', e.target.value as ProductCondition)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.values(ProductCondition).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as ProductStatus)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.values(ProductStatus).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Price / Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Price *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setField('price', parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Currency</label>
              <input
                maxLength={3}
                value={form.currency}
                onChange={(e) => setField('currency', e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="USD"
              />
            </div>
          </div>

          {/* Quantity / MOQ / Delivery */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Stock Qty</label>
              <input
                type="number"
                min="0"
                value={form.quantityAvailable}
                onChange={(e) => setField('quantityAvailable', parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Min Order Qty</label>
              <input
                type="number"
                min="1"
                value={form.minimumOrderQuantity}
                onChange={(e) => setField('minimumOrderQuantity', parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Est. Delivery (days)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={form.estimatedDeliveryDays ?? ''}
                onChange={(e) =>
                  setField(
                    'estimatedDeliveryDays',
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. titanium, structural, grade-5"
            />
          </div>

          {/* Certifications */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Certifications <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <input
              value={certsRaw}
              onChange={(e) => setCertsRaw(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. EASA Form 1, FAA 8130-3, CoC"
            />
          </div>

          {/* Media URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Media URLs <span className="text-gray-400 font-normal">(one per line)</span>
            </label>
            <textarea
              rows={3}
              value={mediaRaw}
              onChange={(e) => setMediaRaw(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 z-10 flex justify-end gap-3 border-t border-gray-100 bg-white pt-4 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Create Listing' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SupplierProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Success banner
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const fetchMyProducts = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await productsApi.list({
        sellerId,
        limit: 100,
      });
      setProducts(result.products);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ??
        (err instanceof Error ? err.message : 'Failed to load your products');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  // Load current user first to get sellerId
  useEffect(() => {
    profileApi
      .getProfile()
      .then((profile) => setSellerId(profile.id))
      .catch(() => setError('Unable to load user profile'));
  }, []);

  useEffect(() => {
    if (sellerId) void fetchMyProducts();
  }, [sellerId, fetchMyProducts]);

  const handleSaved = (product: Product) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = product;
        return next;
      }
      return [product, ...prev];
    });
    setShowCreate(false);
    setEditTarget(null);
    flashSuccess(showCreate ? 'Product created successfully!' : 'Product updated successfully!');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await productsApi.deactivate(deleteTarget.id);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === deleteTarget.id ? { ...p, status: ProductStatus.ARCHIVED } : p,
        ),
      );
      setDeleteTarget(null);
      flashSuccess('Product deactivated successfully');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ??
        (err instanceof Error ? err.message : 'Failed to deactivate product');
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
            <p className="text-sm text-gray-500">Manage your product catalogue</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/marketplace" className="text-sm text-blue-600 hover:underline">
              Browse Marketplace
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              + New Listing
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Success banner */}
        {successMsg && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="h-6 w-6 animate-spin mr-3 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading listings...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-lg font-medium">No listings yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Create your first listing
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.title}</p>
                      <p className="text-xs font-mono text-gray-400">P/N: {p.partNumber}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-600">{CATEGORY_LABELS[p.category] ?? p.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(p.price, p.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-sm text-gray-600">{p.quantityAvailable}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditTarget(p)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        {p.status !== ProductStatus.ARCHIVED && (
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="text-xs font-medium text-red-500 hover:text-red-700"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <ProductFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <ProductFormModal
          mode="edit"
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Deactivate listing?</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{deleteTarget.title}</strong> will be archived and hidden from the marketplace.
            </p>
            {deleteError && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirmDelete()}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
