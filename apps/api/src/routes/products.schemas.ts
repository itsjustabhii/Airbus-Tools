import { ProductCategory, ProductCondition, ProductStatus } from '@airbus-tools/shared';
import { z } from 'zod';

// ── Allowed sort fields (whitelist) ───────────────────────────────────────────
export const ALLOWED_SORT_FIELDS = ['price', 'createdAt', 'title'] as const;
export type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number];

// ── Shared sub-schemas ────────────────────────────────────────────────────────
const dimensionsSchema = z.object({
  length: z.number().nonnegative('Length cannot be negative'),
  width: z.number().nonnegative('Width cannot be negative'),
  height: z.number().nonnegative('Height cannot be negative'),
  unit: z.enum(['mm', 'cm', 'm', 'in', 'ft']).default('mm'),
});

// ── GET /api/products — query params ─────────────────────────────────────────
export const listProductsQuerySchema = z.object({
  /** Free-text search against the text index */
  search: z.string().trim().max(200).optional(),
  /** Filter by exact category enum value */
  category: z.nativeEnum(ProductCategory).optional(),
  /** Filter by product condition */
  condition: z.nativeEnum(ProductCondition).optional(),
  /** Filter by status; airlines only see ACTIVE unless otherwise specified */
  status: z.nativeEnum(ProductStatus).optional(),
  /** Seller ID filter (suppliers see only their own listings) */
  sellerId: z.string().optional(),
  /** Minimum price inclusive */
  minPrice: z.coerce.number().nonnegative().optional(),
  /** Maximum price inclusive */
  maxPrice: z.coerce.number().nonnegative().optional(),
  /** Comma-separated tags */
  tags: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((t) => t.trim()).filter(Boolean) : undefined)),
  /** Comma-separated certifications (all must be present) */
  certifications: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((c) => c.trim()).filter(Boolean) : undefined)),
  /** Cursor for next/prev page navigation */
  cursor: z.string().optional(),
  /** Pagination direction */
  direction: z.enum(['next', 'prev']).optional(),
  /** Page size — capped at 100 */
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Sort field — only whitelisted fields accepted */
  sortBy: z.enum(ALLOWED_SORT_FIELDS).default('createdAt'),
  /** Sort direction */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// ── POST /api/products ────────────────────────────────────────────────────────
export const createProductSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  partNumber: z.string().trim().min(1, 'Part number is required').max(100),
  oemPartNumber: z.string().trim().max(100).optional(),
  description: z.string().trim().min(1, 'Description is required').max(5000),
  category: z.nativeEnum(ProductCategory),
  condition: z.nativeEnum(ProductCondition).default(ProductCondition.NEW),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
  price: z.number().nonnegative('Price cannot be negative'),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-character ISO code')
    .toUpperCase()
    .default('USD'),
  quantityAvailable: z.number().int().nonnegative().default(0),
  minimumOrderQuantity: z.number().int().min(1).default(1),
  estimatedDeliveryDays: z.number().int().min(1).max(365).optional(),
  certifications: z.array(z.string().trim().max(100)).default([]),
  tags: z.array(z.string().trim().max(50)).default([]),
  dimensions: dimensionsSchema.optional(),
  weightKg: z.number().nonnegative().optional(),
  mediaUrls: z.array(z.string().url('Each media URL must be a valid URL')).default([]),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ── PATCH /api/products/:id ───────────────────────────────────────────────────
export const updateProductSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    partNumber: z.string().trim().min(1).max(100).optional(),
    oemPartNumber: z.string().trim().max(100).nullable().optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    category: z.nativeEnum(ProductCategory).optional(),
    condition: z.nativeEnum(ProductCondition).optional(),
    status: z.nativeEnum(ProductStatus).optional(),
    price: z.number().nonnegative().optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .toUpperCase()
      .optional(),
    quantityAvailable: z.number().int().nonnegative().optional(),
    minimumOrderQuantity: z.number().int().min(1).optional(),
    estimatedDeliveryDays: z.number().int().min(1).max(365).nullable().optional(),
    certifications: z.array(z.string().trim().max(100)).optional(),
    tags: z.array(z.string().trim().max(50)).optional(),
    dimensions: dimensionsSchema.nullable().optional(),
    weightKg: z.number().nonnegative().nullable().optional(),
    mediaUrls: z.array(z.string().url()).optional(),
  })
  .strict();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ── GET /api/products/:id — no body, id from params ──────────────────────────
export const productIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
});
