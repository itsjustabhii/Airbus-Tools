import { UserRole } from '@airbus-tools/shared';
import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';


import { ValidationError } from '../core/errors';
import { successResponse } from '../core/response';
import type { OrderFilter } from '../database/repositories/OrderRepository';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import type { TransitionOrderInput } from '../services/orderService';
import { orderService } from '../services/orderService';
import { availableTransitions } from '../services/orderStateMachine';

import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  transitionOrderSchema,
} from './orders.schemas';

const router: Router = createRouter();

// All order routes require authentication
router.use(authenticate);

// ── POST /api/orders ──────────────────────────────────────────────────────────
/**
 * Airlines submit a new product request (order).
 * A server-side price snapshot is taken from the current product prices.
 */
router.post(
  '/',
  authorize(UserRole.AIRLINE, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const body = createOrderSchema.parse(req.body);

        const shippingAddressInput: {
          street: string;
          city: string;
          postalCode: string;
          country: string;
          state?: string;
        } = {
          street:     body.shippingAddress.street,
          city:       body.shippingAddress.city,
          postalCode: body.shippingAddress.postalCode,
          country:    body.shippingAddress.country,
        };
        if (body.shippingAddress.state !== undefined) {
          shippingAddressInput.state = body.shippingAddress.state;
        }

        const order = await orderService.createOrder({
          buyerId: req.user!.sub,
          items: body.items,
          shippingAddress: shippingAddressInput,
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        });

        res.status(201).json(successResponse({ order: order.toJSON() }));
      } catch (err) {
        next(err);
      }
    })();
  },
);

// ── GET /api/orders ───────────────────────────────────────────────────────────
/**
 * List orders.
 * - AIRLINE:   sees only their own purchase orders.
 * - SUPPLIER:  sees only orders where they are the seller.
 * - ADMIN:     sees all orders.
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const query = listOrdersQuerySchema.parse(req.query);

      const listFilter: Omit<OrderFilter, 'buyerId' | 'sellerId'> = {};
      if (query.status    !== undefined) listFilter.status    = query.status;
      if (query.startDate !== undefined) listFilter.startDate = query.startDate;
      if (query.endDate   !== undefined) listFilter.endDate   = query.endDate;

      const result = await orderService.listOrders(
        req.user!.sub,
        req.user!.role as UserRole,
        listFilter,
        { page: query.page, limit: query.limit },
      );

      res.status(200).json(
        successResponse(
          { orders: result.items.map((o) => o.toJSON()) },
          {
            page:       result.page,
            limit:      result.limit,
            total:      result.total,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
          },
        ),
      );
    } catch (err) {
      next(err);
    }
  })();
});

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
/**
 * Get a single order.
 * Only participants (buyer, seller) or admins may access an order.
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const { id } = orderIdParamSchema.parse(req.params);

      const order = await orderService.getOrder(
        id,
        req.user!.sub,
        req.user!.role as UserRole,
      );

      const callerRole = req.user!.role as UserRole;
      const nextStates = availableTransitions(order.status, callerRole);

      res.status(200).json(
        successResponse({
          order: order.toJSON(),
          availableTransitions: nextStates,
        }),
      );
    } catch (err) {
      next(err);
    }
  })();
});

// ── PATCH /api/orders/:id/status ─────────────────────────────────────────────
/**
 * Advance the order through the state machine.
 *
 * Valid transitions (who may trigger):
 *   PENDING         → ACCEPTED         (SUPPLIER)
 *   PENDING         → REJECTED         (SUPPLIER) — rejectionReason required
 *   ACCEPTED        → PAYMENT_PENDING  (AIRLINE)
 *   PAYMENT_PENDING → PAID             (AIRLINE)
 *   PAID            → COMPLETED        (SUPPLIER)
 *
 * Invalid transitions, wrong roles, or modifications to terminal orders return
 * 409 / 403 respectively.
 *
 * Field ownership:
 *   - AIRLINE may not set rejectionReason (supplier-owned field).
 *   - SUPPLIER may not change shippingAddress or notes (buyer-owned fields).
 */
router.patch('/:id/status', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const { id } = orderIdParamSchema.parse(req.params);
      const body    = transitionOrderSchema.parse(req.body);

      const callerRole = req.user!.role as UserRole;

      // Field ownership guard: only SUPPLIER may supply a rejectionReason
      if (body.rejectionReason !== undefined && callerRole === UserRole.AIRLINE) {
        throw new ValidationError('Airlines cannot set the rejection reason');
      }

      const transitionInput: TransitionOrderInput = {
        orderId:    id,
        nextStatus: body.status,
        callerId:   req.user!.sub,
        callerRole,
      };
      if (body.rejectionReason !== undefined) {
        transitionInput.rejectionReason = body.rejectionReason;
      }

      const updated = await orderService.transitionOrder(transitionInput);

      res.status(200).json(successResponse({ order: updated.toJSON() }));
    } catch (err) {
      next(err);
    }
  })();
});

export { router as ordersRouter };
