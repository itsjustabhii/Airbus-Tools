"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
const shared_1 = require("@airbus-tools/shared");
const express_1 = require("express");
const errors_1 = require("../core/errors");
const response_1 = require("../core/response");
const authenticate_1 = require("../middlewares/authenticate");
const authorize_1 = require("../middlewares/authorize");
const orderService_1 = require("../services/orderService");
const orderStateMachine_1 = require("../services/orderStateMachine");
const orders_schemas_1 = require("./orders.schemas");
const router = (0, express_1.Router)();
exports.ordersRouter = router;
// All order routes require authentication
router.use(authenticate_1.authenticate);
// ── POST /api/orders ──────────────────────────────────────────────────────────
/**
 * Airlines submit a new product request (order).
 * A server-side price snapshot is taken from the current product prices.
 */
router.post('/', (0, authorize_1.authorize)(shared_1.UserRole.AIRLINE, shared_1.UserRole.ADMIN), (req, res, next) => {
    void (async () => {
        try {
            const body = orders_schemas_1.createOrderSchema.parse(req.body);
            const shippingAddressInput = {
                street: body.shippingAddress.street,
                city: body.shippingAddress.city,
                postalCode: body.shippingAddress.postalCode,
                country: body.shippingAddress.country,
            };
            if (body.shippingAddress.state !== undefined) {
                shippingAddressInput.state = body.shippingAddress.state;
            }
            const order = await orderService_1.orderService.createOrder({
                buyerId: req.user.sub,
                items: body.items,
                shippingAddress: shippingAddressInput,
                ...(body.notes !== undefined ? { notes: body.notes } : {}),
            });
            res.status(201).json((0, response_1.successResponse)({ order: order.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
// ── GET /api/orders ───────────────────────────────────────────────────────────
/**
 * List orders.
 * - AIRLINE:   sees only their own purchase orders.
 * - SUPPLIER:  sees only orders where they are the seller.
 * - ADMIN:     sees all orders.
 */
router.get('/', (req, res, next) => {
    void (async () => {
        try {
            const query = orders_schemas_1.listOrdersQuerySchema.parse(req.query);
            const listFilter = {};
            if (query.status !== undefined)
                listFilter.status = query.status;
            if (query.startDate !== undefined)
                listFilter.startDate = query.startDate;
            if (query.endDate !== undefined)
                listFilter.endDate = query.endDate;
            const result = await orderService_1.orderService.listOrders(req.user.sub, req.user.role, listFilter, { page: query.page, limit: query.limit });
            res.status(200).json((0, response_1.successResponse)({ orders: result.items.map((o) => o.toJSON()) }, {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage,
            }));
        }
        catch (err) {
            next(err);
        }
    })();
});
// ── GET /api/orders/:id ───────────────────────────────────────────────────────
/**
 * Get a single order.
 * Only participants (buyer, seller) or admins may access an order.
 */
router.get('/:id', (req, res, next) => {
    void (async () => {
        try {
            const { id } = orders_schemas_1.orderIdParamSchema.parse(req.params);
            const order = await orderService_1.orderService.getOrder(id, req.user.sub, req.user.role);
            const callerRole = req.user.role;
            const nextStates = (0, orderStateMachine_1.availableTransitions)(order.status, callerRole);
            res.status(200).json((0, response_1.successResponse)({
                order: order.toJSON(),
                availableTransitions: nextStates,
            }));
        }
        catch (err) {
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
router.patch('/:id/status', (req, res, next) => {
    void (async () => {
        try {
            const { id } = orders_schemas_1.orderIdParamSchema.parse(req.params);
            const body = orders_schemas_1.transitionOrderSchema.parse(req.body);
            const callerRole = req.user.role;
            // Field ownership guard: only SUPPLIER may supply a rejectionReason
            if (body.rejectionReason !== undefined && callerRole === shared_1.UserRole.AIRLINE) {
                throw new errors_1.ValidationError('Airlines cannot set the rejection reason');
            }
            const transitionInput = {
                orderId: id,
                nextStatus: body.status,
                callerId: req.user.sub,
                callerRole,
            };
            if (body.rejectionReason !== undefined) {
                transitionInput.rejectionReason = body.rejectionReason;
            }
            const updated = await orderService_1.orderService.transitionOrder(transitionInput);
            res.status(200).json((0, response_1.successResponse)({ order: updated.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=orders.js.map