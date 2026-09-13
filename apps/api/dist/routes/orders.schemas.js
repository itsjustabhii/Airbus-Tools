"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderIdParamSchema = exports.listOrdersQuerySchema = exports.transitionOrderSchema = exports.createOrderSchema = exports.orderItemInputSchema = exports.shippingAddressSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("@airbus-tools/shared");
// ── Shared sub-schemas ───────────────────────────────────────────────────────
exports.shippingAddressSchema = zod_1.z.object({
    street: zod_1.z.string().trim().min(1).max(200),
    city: zod_1.z.string().trim().min(1).max(100),
    state: zod_1.z.string().trim().max(100).optional(),
    postalCode: zod_1.z.string().trim().min(1).max(20),
    country: zod_1.z.string().trim().min(2).max(100),
});
exports.orderItemInputSchema = zod_1.z.object({
    productId: zod_1.z.string().trim().min(1, 'productId is required'),
    quantity: zod_1.z.number().int().min(1, 'Quantity must be at least 1'),
});
// ── POST /orders ─────────────────────────────────────────────────────────────
exports.createOrderSchema = zod_1.z.object({
    items: zod_1.z.array(exports.orderItemInputSchema).min(1, 'At least one item is required'),
    shippingAddress: exports.shippingAddressSchema,
    notes: zod_1.z.string().trim().max(2000).optional(),
});
// ── PATCH /orders/:id/status ─────────────────────────────────────────────────
exports.transitionOrderSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(shared_1.OrderStatus),
    rejectionReason: zod_1.z.string().trim().min(1).max(1000).optional(),
});
// ── GET /orders query params ─────────────────────────────────────────────────
exports.listOrdersQuerySchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(shared_1.OrderStatus).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
});
// ── Params ───────────────────────────────────────────────────────────────────
exports.orderIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1),
});
//# sourceMappingURL=orders.schemas.js.map