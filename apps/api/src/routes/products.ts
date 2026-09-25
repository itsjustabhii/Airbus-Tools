import type { ApiMeta } from '@airbus-tools/shared';
import { ProductStatus, UserRole } from '@airbus-tools/shared';
import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';


import { ForbiddenError, NotFoundError, ValidationError } from '../core/errors';
import { successResponse } from '../core/response';
import { productRepository } from '../database/repositories/ProductRepository';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from './products.schemas';

const router: Router = createRouter();

// ── Public list & detail endpoints ───────────────────────────────────────────

/**
 * GET /api/products
 * Returns a cursor-paginated list of products.
 * - Unauthenticated / airline callers: only ACTIVE products are visible.
 * - SUPPLIER callers: can scope to their own listings including non-ACTIVE statuses.
 * - ADMIN: no status restriction applied automatically.
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const query = listProductsQuerySchema.parse(req.query);

      // ── Authorization-aware status filtering ─────────────────────────────
      const role = req.user?.role as UserRole | undefined;

      // Suppliers may only see their own products when querying non-ACTIVE status
      if (query.status && query.status !== ProductStatus.ACTIVE) {
        if (role === UserRole.SUPPLIER) {
          // Force sellerId scope to their own id
          query.sellerId = req.user!.sub;
        } else if (role !== UserRole.ADMIN) {
          // Everyone else (airlines, unauthenticated) is locked to ACTIVE
          query.status = ProductStatus.ACTIVE;
        }
      }

      // Un-authenticated or non-supplier always defaults to ACTIVE
      if (!query.status) {
        query.status = ProductStatus.ACTIVE;
      }

      // ── Build catalog filter (server-side safe — no raw operators) ───────
      const sortDir: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;

      const catalogFilter: import('../database/repositories/ProductRepository').ProductCatalogFilter = {
        status: query.status,
      };
      if (query.category !== undefined) catalogFilter.category = query.category;
      if (query.condition !== undefined) catalogFilter.condition = query.condition;
      if (query.sellerId !== undefined) catalogFilter.sellerId = query.sellerId;
      if (query.minPrice !== undefined) catalogFilter.minPrice = query.minPrice;
      if (query.maxPrice !== undefined) catalogFilter.maxPrice = query.maxPrice;
      if (query.tags !== undefined) catalogFilter.tags = query.tags;
      if (query.certifications !== undefined) catalogFilter.certifications = query.certifications;
      if (query.search !== undefined) catalogFilter.searchTerm = query.search;

      const cursorOptions: import('../database/repositories/BaseRepository').CursorPaginationOptions = {
        limit: query.limit,
        sortField: query.sortBy === 'createdAt' ? '_id' : query.sortBy,
        sortDir,
      };
      if (query.cursor !== undefined) cursorOptions.cursor = query.cursor;
      if (query.direction !== undefined) cursorOptions.direction = query.direction;

      const result = await productRepository.searchCatalogCursor(catalogFilter, cursorOptions);

      const meta: ApiMeta = {
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      };
      if (result.nextCursor !== null) meta.nextCursor = result.nextCursor;
      if (result.prevCursor !== null) meta.prevCursor = result.prevCursor;

      res.status(200).json(
        successResponse(
          { products: result.items.map((p) => p.toJSON()) },
          meta,
        ),
      );
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * GET /api/products/:id
 * Returns a single product by ID.
 * - Non-ACTIVE products are only accessible by the owning supplier or an admin.
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const { id } = productIdParamSchema.parse(req.params);
      const product = await productRepository.findById(id);

      if (!product) {
        throw new NotFoundError('Product not found');
      }

      const role = req.user?.role as UserRole | undefined;
      const isOwner = req.user?.sub === product.sellerId.toString();
      const isAdmin = role === UserRole.ADMIN;

      // Non-ACTIVE products are hidden unless owner or admin
      if (product.status !== ProductStatus.ACTIVE && !isOwner && !isAdmin) {
        throw new NotFoundError('Product not found');
      }

      res.status(200).json(successResponse({ product: product.toJSON() }));
    } catch (err) {
      next(err);
    }
  })();
});

// ── Write endpoints require authentication ────────────────────────────────────

router.use(authenticate);

/**
 * POST /api/products
 * Creates a new product listing.
 * Only SUPPLIER and ADMIN may create products.
 */
router.post(
  '/',
  authorize(UserRole.SUPPLIER, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const input = createProductSchema.parse(req.body);

        const sellerId =
          req.user!.role === UserRole.ADMIN && req.body.sellerId
            ? (req.body.sellerId as string)
            : req.user!.sub;

        // Build the create payload, omitting optional undefined fields to satisfy
        // exactOptionalPropertyTypes
        const createPayload: Parameters<typeof productRepository.create>[0] = {
          sellerId: sellerId as never,
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
        if (input.oemPartNumber !== undefined) createPayload.oemPartNumber = input.oemPartNumber;
        if (input.estimatedDeliveryDays !== undefined) createPayload.estimatedDeliveryDays = input.estimatedDeliveryDays;
        if (input.dimensions !== undefined) createPayload.dimensions = input.dimensions;
        if (input.weightKg !== undefined) createPayload.weightKg = input.weightKg;

        const product = await productRepository.create(createPayload);

        res.status(201).json(successResponse({ product: product.toJSON() }));
      } catch (err) {
        next(err);
      }
    })();
  },
);

/**
 * PATCH /api/products/:id
 * Partially updates a product.
 * - SUPPLIER: can only update their own products.
 * - ADMIN: can update any product.
 */
router.patch(
  '/:id',
  authorize(UserRole.SUPPLIER, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const { id } = productIdParamSchema.parse(req.params);
        const input = updateProductSchema.parse(req.body);

        if (Object.keys(input).length === 0) {
          throw new ValidationError('No update fields provided');
        }

        const existing = await productRepository.findById(id);
        if (!existing) {
          throw new NotFoundError('Product not found');
        }

        // Ownership check for suppliers
        if (req.user!.role === UserRole.SUPPLIER) {
          if (existing.sellerId.toString() !== req.user!.sub) {
            throw new ForbiddenError('You do not own this product');
          }
        }

        const updated = await productRepository.updateById(id, input as never);
        if (!updated) {
          throw new NotFoundError('Product not found');
        }

        res.status(200).json(successResponse({ product: updated.toJSON() }));
      } catch (err) {
        next(err);
      }
    })();
  },
);

/**
 * DELETE /api/products/:id
 * Deactivates (soft-deletes) a product by setting status = ARCHIVED.
 * Physical deletion is restricted to ADMIN only.
 * - SUPPLIER: sets status to ARCHIVED (deactivate).
 * - ADMIN: permanently deletes.
 */
router.delete(
  '/:id',
  authorize(UserRole.SUPPLIER, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const { id } = productIdParamSchema.parse(req.params);

        const existing = await productRepository.findById(id);
        if (!existing) {
          throw new NotFoundError('Product not found');
        }

        if (req.user!.role === UserRole.ADMIN) {
          // Hard delete
          await productRepository.deleteById(id);
          res.status(200).json(successResponse({ message: 'Product permanently deleted' }));
        } else {
          // Supplier — ownership check then soft-delete
          if (existing.sellerId.toString() !== req.user!.sub) {
            throw new ForbiddenError('You do not own this product');
          }
          const archived = await productRepository.updateStatus(id, ProductStatus.ARCHIVED);
          res.status(200).json(successResponse({ product: archived?.toJSON() }));
        }
      } catch (err) {
        next(err);
      }
    })();
  },
);

export { router as productsRouter };
