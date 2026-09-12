import type { Product, ProductCategory, ProductCondition, ProductStatus } from '@airbus-tools/shared';
import { apiClient } from './profileApi';

// ── Shared response shapes ────────────────────────────────────────────────────

export interface ProductsListMeta {
  limit: number;
  nextCursor?: string;
  prevCursor?: string;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface ProductsListResponse {
  products: Product[];
  meta: ProductsListMeta;
}

// ── Query params for listing ──────────────────────────────────────────────────

export interface ListProductsParams {
  search?: string;
  category?: ProductCategory;
  condition?: ProductCondition;
  status?: ProductStatus;
  sellerId?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string;
  certifications?: string;
  cursor?: string;
  direction?: 'next' | 'prev';
  limit?: number;
  sortBy?: 'price' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// ── Create / update payloads ──────────────────────────────────────────────────

export interface ProductDimensionsInput {
  length: number;
  width: number;
  height: number;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
}

export interface CreateProductPayload {
  title: string;
  partNumber: string;
  oemPartNumber?: string;
  description: string;
  category: ProductCategory;
  condition?: ProductCondition;
  status?: ProductStatus;
  price: number;
  currency?: string;
  quantityAvailable?: number;
  minimumOrderQuantity?: number;
  estimatedDeliveryDays?: number;
  certifications?: string[];
  tags?: string[];
  dimensions?: ProductDimensionsInput;
  weightKg?: number;
  mediaUrls?: string[];
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

// ── API calls ─────────────────────────────────────────────────────────────────

export const productsApi = {
  list: async (params: ListProductsParams = {}): Promise<ProductsListResponse> => {
    const query: Record<string, string> = {};
    if (params.search) query.search = params.search;
    if (params.category) query.category = params.category;
    if (params.condition) query.condition = params.condition;
    if (params.status) query.status = params.status;
    if (params.sellerId) query.sellerId = params.sellerId;
    if (params.minPrice !== undefined) query.minPrice = String(params.minPrice);
    if (params.maxPrice !== undefined) query.maxPrice = String(params.maxPrice);
    if (params.tags) query.tags = params.tags;
    if (params.certifications) query.certifications = params.certifications;
    if (params.cursor) query.cursor = params.cursor;
    if (params.direction) query.direction = params.direction;
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.sortBy) query.sortBy = params.sortBy;
    if (params.sortOrder) query.sortOrder = params.sortOrder;

    const res = await apiClient.get<{
      success: boolean;
      data: { products: Product[] };
      meta: ProductsListMeta;
    }>('/products', { params: query });

    return {
      products: res.data.data.products,
      meta: res.data.meta ?? { limit: params.limit ?? 20 },
    };
  },

  getById: async (id: string): Promise<Product> => {
    const res = await apiClient.get<{ success: boolean; data: { product: Product } }>(
      `/products/${id}`,
    );
    return res.data.data.product;
  },

  create: async (payload: CreateProductPayload): Promise<Product> => {
    const res = await apiClient.post<{ success: boolean; data: { product: Product } }>(
      '/products',
      payload,
    );
    return res.data.data.product;
  },

  update: async (id: string, payload: UpdateProductPayload): Promise<Product> => {
    const res = await apiClient.patch<{ success: boolean; data: { product: Product } }>(
      `/products/${id}`,
      payload,
    );
    return res.data.data.product;
  },

  deactivate: async (id: string): Promise<Product | { message: string }> => {
    const res = await apiClient.delete<{
      success: boolean;
      data: { product?: Product; message?: string };
    }>(`/products/${id}`);
    return (res.data.data.product ?? res.data.data) as Product | { message: string };
  },
};
