"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsRouter = void 0;
const shared_1 = require("@airbus-tools/shared");
const express_1 = require("express");
const errors_1 = require("../core/errors");
const response_1 = require("../core/response");
const ProductRepository_1 = require("../database/repositories/ProductRepository");
const authenticate_1 = require("../middlewares/authenticate");
const authorize_1 = require("../middlewares/authorize");
const products_schemas_1 = require("./products.schemas");
const router = (0, express_1.Router)();
exports.productsRouter = router;
// ── Public list & detail endpoints ───────────────────────────────────────────
/**
 * GET /api/products
 * Returns a cursor-paginated list of products.
 * - Unauthenticated / airline callers: only ACTIVE products are visible.
 * - SUPPLIER callers: can scope to their own listings including non-ACTIVE statuses.
 * - ADMIN: no status restriction applied automatically.
 */
router.get('/', (req, res, next) => {
    void (async () => {
        try {
            const query = products_schemas_1.listProductsQuerySchema.parse(req.query);
            // ── Authorization-aware status filtering ─────────────────────────────
            const role = req.user?.role;
            // Suppliers may only see their own products when querying non-ACTIVE status
            if (query.status && query.status !== shared_1.ProductStatus.ACTIVE) {
                if (role === shared_1.UserRole.SUPPLIER) {
                    // Force sellerId scope to their own id
                    query.sellerId = req.user.sub;
                }
                else if (role !== shared_1.UserRole.ADMIN) {
                    // Everyone else (airlines, unauthenticated) is locked to ACTIVE
                    query.status = shared_1.ProductStatus.ACTIVE;
                }
            }
            // Un-authenticated or non-supplier always defaults to ACTIVE
            if (!query.status) {
                query.status = shared_1.ProductStatus.ACTIVE;
            }
            // ── Build catalog filter (server-side safe — no raw operators) ───────
            const sortDir = query.sortOrder === 'asc' ? 1 : -1;
            const catalogFilter = {
                status: query.status,
            };
            if (query.category !== undefined)
                catalogFilter.category = query.category;
            if (query.condition !== undefined)
                catalogFilter.condition = query.condition;
            if (query.sellerId !== undefined)
                catalogFilter.sellerId = query.sellerId;
            if (query.minPrice !== undefined)
                catalogFilter.minPrice = query.minPrice;
            if (query.maxPrice !== undefined)
                catalogFilter.maxPrice = query.maxPrice;
            if (query.tags !== undefined)
                catalogFilter.tags = query.tags;
            if (query.certifications !== undefined)
                catalogFilter.certifications = query.certifications;
            if (query.search !== undefined)
                catalogFilter.searchTerm = query.search;
            const cursorOptions = {
                limit: query.limit,
                sortField: query.sortBy === 'createdAt' ? '_id' : query.sortBy,
                sortDir,
            };
            if (query.cursor !== undefined)
                cursorOptions.cursor = query.cursor;
            if (query.direction !== undefined)
                cursorOptions.direction = query.direction;
            const result = await ProductRepository_1.productRepository.searchCatalogCursor(catalogFilter, cursorOptions);
            const meta = {
                limit: result.limit,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage,
            };
            if (result.nextCursor !== null)
                meta.nextCursor = result.nextCursor;
            if (result.prevCursor !== null)
                meta.prevCursor = result.prevCursor;
            res.status(200).json((0, response_1.successResponse)({ products: result.items.map((p) => p.toJSON()) }, meta));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * GET /api/products/:id
 * Returns a single product by ID.
 * - Non-ACTIVE products are only accessible by the owning supplier or an admin.
 */
router.get('/:id', (req, res, next) => {
    void (async () => {
        try {
            const { id } = products_schemas_1.productIdParamSchema.parse(req.params);
            const product = await ProductRepository_1.productRepository.findById(id);
            if (!product) {
                throw new errors_1.NotFoundError('Product not found');
            }
            const role = req.user?.role;
            const isOwner = req.user?.sub === product.sellerId.toString();
            const isAdmin = role === shared_1.UserRole.ADMIN;
            // Non-ACTIVE products are hidden unless owner or admin
            if (product.status !== shared_1.ProductStatus.ACTIVE && !isOwner && !isAdmin) {
                throw new errors_1.NotFoundError('Product not found');
            }
            res.status(200).json((0, response_1.successResponse)({ product: product.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
// ── Write endpoints require authentication ────────────────────────────────────
router.use(authenticate_1.authenticate);
/**
 * POST /api/products
 * Creates a new product listing.
 * Only SUPPLIER and ADMIN may create products.
 */
router.post('/', (0, authorize_1.authorize)(shared_1.UserRole.SUPPLIER, shared_1.UserRole.ADMIN), (req, res, next) => {
    void (async () => {
        try {
            const input = products_schemas_1.createProductSchema.parse(req.body);
            const sellerId = req.user.role === shared_1.UserRole.ADMIN && req.body.sellerId
                ? req.body.sellerId
                : req.user.sub;
            // Build the create payload, omitting optional undefined fields to satisfy
            // exactOptionalPropertyTypes
            const createPayload = {
                sellerId: sellerId,
                title: input.title,
                partNumber: input.partNumber,
                description: input.description,
                category: input.category,
                condition: input.condition,
                status: input.status,
                price: input.price,
                currency: input.currency,
                quantityAvailable: input.quantityAvailable,
                minimumOrderQuantity: input.minimumOrderQuantity,
                certifications: input.certifications,
                tags: input.tags,
                mediaUrls: input.mediaUrls,
            };
            if (input.oemPartNumber !== undefined)
                createPayload.oemPartNumber = input.oemPartNumber;
            if (input.estimatedDeliveryDays !== undefined)
                createPayload.estimatedDeliveryDays = input.estimatedDeliveryDays;
            if (input.dimensions !== undefined)
                createPayload.dimensions = input.dimensions;
            if (input.weightKg !== undefined)
                createPayload.weightKg = input.weightKg;
            const product = await ProductRepository_1.productRepository.create(createPayload);
            res.status(201).json((0, response_1.successResponse)({ product: product.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * PATCH /api/products/:id
 * Partially updates a product.
 * - SUPPLIER: can only update their own products.
 * - ADMIN: can update any product.
 */
router.patch('/:id', (0, authorize_1.authorize)(shared_1.UserRole.SUPPLIER, shared_1.UserRole.ADMIN), (req, res, next) => {
    void (async () => {
        try {
            const { id } = products_schemas_1.productIdParamSchema.parse(req.params);
            const input = products_schemas_1.updateProductSchema.parse(req.body);
            if (Object.keys(input).length === 0) {
                throw new errors_1.ValidationError('No update fields provided');
            }
            const existing = await ProductRepository_1.productRepository.findById(id);
            if (!existing) {
                throw new errors_1.NotFoundError('Product not found');
            }
            // Ownership check for suppliers
            if (req.user.role === shared_1.UserRole.SUPPLIER) {
                if (existing.sellerId.toString() !== req.user.sub) {
                    throw new errors_1.ForbiddenError('You do not own this product');
                }
            }
            const updated = await ProductRepository_1.productRepository.updateById(id, input);
            if (!updated) {
                throw new errors_1.NotFoundError('Product not found');
            }
            res.status(200).json((0, response_1.successResponse)({ product: updated.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * DELETE /api/products/:id
 * Deactivates (soft-deletes) a product by setting status = ARCHIVED.
 * Physical deletion is restricted to ADMIN only.
 * - SUPPLIER: sets status to ARCHIVED (deactivate).
 * - ADMIN: permanently deletes.
 */
router.delete('/:id', (0, authorize_1.authorize)(shared_1.UserRole.SUPPLIER, shared_1.UserRole.ADMIN), (req, res, next) => {
    void (async () => {
        try {
            const { id } = products_schemas_1.productIdParamSchema.parse(req.params);
            const existing = await ProductRepository_1.productRepository.findById(id);
            if (!existing) {
                throw new errors_1.NotFoundError('Product not found');
            }
            if (req.user.role === shared_1.UserRole.ADMIN) {
                // Hard delete
                await ProductRepository_1.productRepository.deleteById(id);
                res.status(200).json((0, response_1.successResponse)({ message: 'Product permanently deleted' }));
            }
            else {
                // Supplier — ownership check then soft-delete
                if (existing.sellerId.toString() !== req.user.sub) {
                    throw new errors_1.ForbiddenError('You do not own this product');
                }
                const archived = await ProductRepository_1.productRepository.updateStatus(id, shared_1.ProductStatus.ARCHIVED);
                res.status(200).json((0, response_1.successResponse)({ product: archived?.toJSON() }));
            }
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=products.js.map