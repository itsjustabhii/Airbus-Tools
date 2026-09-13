"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentIdParamSchema = exports.refundPaymentSchema = exports.confirmPaymentSchema = exports.createPaymentSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("@airbus-tools/shared");
// ── POST /payments ────────────────────────────────────────────────────────────
exports.createPaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string().trim().min(1, 'orderId is required'),
    paymentMethod: zod_1.z.nativeEnum(shared_1.PaymentMethod),
    currency: zod_1.z.string().trim().length(3).toUpperCase().optional(),
    /**
     * Caller-supplied UUID for idempotency.
     * Two requests with the same key return the existing payment.
     */
    idempotencyKey: zod_1.z.string().trim().uuid('idempotencyKey must be a UUID v4'),
});
// ── POST /payments/:id/confirm ────────────────────────────────────────────────
exports.confirmPaymentSchema = zod_1.z.object({
    /**
     * Provider SDK token returned after the client-side payment UI completes
     * (e.g. Stripe's PaymentMethod ID).  Optional for mock provider.
     */
    paymentMethodToken: zod_1.z.string().trim().min(1).optional(),
});
// ── POST /payments/:id/refund ─────────────────────────────────────────────────
exports.refundPaymentSchema = zod_1.z.object({
    reason: zod_1.z.string().trim().max(500).optional(),
});
// ── Params ────────────────────────────────────────────────────────────────────
exports.paymentIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1),
});
//# sourceMappingURL=payments.schemas.js.map