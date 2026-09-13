"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productIdParamSchema = exports.updateProductSchema = exports.createProductSchema = exports.listProductsQuerySchema = exports.ALLOWED_SORT_FIELDS = void 0;
const shared_1 = require("@airbus-tools/shared");
const zod_1 = require("zod");
// ── Allowed sort fields (whitelist) ───────────────────────────────────────────
exports.ALLOWED_SORT_FIELDS = ['price', 'createdAt', 'title'];
// ── Shared sub-schemas ────────────────────────────────────────────────────────
const dimensionsSchema = zod_1.z.object({
    length: zod_1.z.number().nonnegative('Length cannot be negative'),
    width: zod_1.z.number().nonnegative('Width cannot be negative'),
    height: zod_1.z.number().nonnegative('Height cannot be negative'),
    unit: zod_1.z.enum(['mm', 'cm', 'm', 'in', 'ft']).default('mm'),
});
// ── GET /api/products — query params ─────────────────────────────────────────
exports.listProductsQuerySchema = zod_1.z.object({
    /** Free-text search against the text index */
    search: zod_1.z.string().trim().max(200).optional(),
    /** Filter by exact category enum value */
    category: zod_1.z.nativeEnum(shared_1.ProductCategory).optional(),
    /** Filter by product condition */
    condition: zod_1.z.nativeEnum(shared_1.ProductCondition).optional(),
    /** Filter by status; airlines only see ACTIVE unless otherwise specified */
    status: zod_1.z.nativeEnum(shared_1.ProductStatus).optional(),
    /** Seller ID filter (suppliers see only their own listings) */
    sellerId: zod_1.z.string().optional(),
    /** Minimum price inclusive */
    minPrice: zod_1.z.coerce.number().nonnegative().optional(),
    /** Maximum price inclusive */
    maxPrice: zod_1.z.coerce.number().nonnegative().optional(),
    /** Comma-separated tags */
    tags: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? v.split(',').map((t) => t.trim()).filter(Boolean) : undefined)),
    /** Comma-separated certifications (all must be present) */
    certifications: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? v.split(',').map((c) => c.trim()).filter(Boolean) : undefined)),
    /** Cursor for next/prev page navigation */
    cursor: zod_1.z.string().optional(),
    /** Pagination direction */
    direction: zod_1.z.enum(['next', 'prev']).optional(),
    /** Page size — capped at 100 */
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    /** Sort field — only whitelisted fields accepted */
    sortBy: zod_1.z.enum(exports.ALLOWED_SORT_FIELDS).default('createdAt'),
    /** Sort direction */
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
// ── POST /api/products ────────────────────────────────────────────────────────
exports.createProductSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, 'Title is required').max(200),
    partNumber: zod_1.z.string().trim().min(1, 'Part number is required').max(100),
    oemPartNumber: zod_1.z.string().trim().max(100).optional(),
    description: zod_1.z.string().trim().min(1, 'Description is required').max(5000),
    category: zod_1.z.nativeEnum(shared_1.ProductCategory),
    condition: zod_1.z.nativeEnum(shared_1.ProductCondition).default(shared_1.ProductCondition.NEW),
    status: zod_1.z.nativeEnum(shared_1.ProductStatus).default(shared_1.ProductStatus.DRAFT),
    price: zod_1.z.number().nonnegative('Price cannot be negative'),
    currency: zod_1.z
        .string()
        .trim()
        .length(3, 'Currency must be a 3-character ISO code')
        .toUpperCase()
        .default('USD'),
    quantityAvailable: zod_1.z.number().int().nonnegative().default(0),
    minimumOrderQuantity: zod_1.z.number().int().min(1).default(1),
    estimatedDeliveryDays: zod_1.z.number().int().min(1).max(365).optional(),
    certifications: zod_1.z.array(zod_1.z.string().trim().max(100)).default([]),
    tags: zod_1.z.array(zod_1.z.string().trim().max(50)).default([]),
    dimensions: dimensionsSchema.optional(),
    weightKg: zod_1.z.number().nonnegative().optional(),
    mediaUrls: zod_1.z.array(zod_1.z.string().url('Each media URL must be a valid URL')).default([]),
});
// ── PATCH /api/products/:id ───────────────────────────────────────────────────
exports.updateProductSchema = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(1).max(200).optional(),
    partNumber: zod_1.z.string().trim().min(1).max(100).optional(),
    oemPartNumber: zod_1.z.string().trim().max(100).nullable().optional(),
    description: zod_1.z.string().trim().min(1).max(5000).optional(),
    category: zod_1.z.nativeEnum(shared_1.ProductCategory).optional(),
    condition: zod_1.z.nativeEnum(shared_1.ProductCondition).optional(),
    status: zod_1.z.nativeEnum(shared_1.ProductStatus).optional(),
    price: zod_1.z.number().nonnegative().optional(),
    currency: zod_1.z
        .string()
        .trim()
        .length(3)
        .toUpperCase()
        .optional(),
    quantityAvailable: zod_1.z.number().int().nonnegative().optional(),
    minimumOrderQuantity: zod_1.z.number().int().min(1).optional(),
    estimatedDeliveryDays: zod_1.z.number().int().min(1).max(365).nullable().optional(),
    certifications: zod_1.z.array(zod_1.z.string().trim().max(100)).optional(),
    tags: zod_1.z.array(zod_1.z.string().trim().max(50)).optional(),
    dimensions: dimensionsSchema.nullable().optional(),
    weightKg: zod_1.z.number().nonnegative().nullable().optional(),
    mediaUrls: zod_1.z.array(zod_1.z.string().url()).optional(),
})
    .strict();
// ── GET /api/products/:id — no body, id from params ──────────────────────────
exports.productIdParamSchema = zod_1.z.object({
    id: zod_1.z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
});
//# sourceMappingURL=products.schemas.js.map