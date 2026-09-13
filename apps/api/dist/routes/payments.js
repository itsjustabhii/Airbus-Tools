"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const shared_1 = require("@airbus-tools/shared");
const response_1 = require("../core/response");
const authenticate_1 = require("../middlewares/authenticate");
const authorize_1 = require("../middlewares/authorize");
const payment_1 = require("../services/payment");
const payments_schemas_1 = require("./payments.schemas");
const router = (0, express_1.Router)();
exports.paymentsRouter = router;
// ── POST /payments/webhook ────────────────────────────────────────────────────
/**
 * Raw-body webhook — must come BEFORE authenticate/json middlewares.
 *
 * The provider signs the raw bytes; any JSON body parsing before this handler
 * would corrupt the signature check.
 *
 * Security: the route validates the HMAC-SHA256 signature before processing.
 * An invalid signature returns HTTP 400 (not 401/403) to avoid leaking
 * information about what is a valid versus unknown endpoint.
 */
router.post('/webhook', express_2.default.raw({ type: '*/*', limit: '256kb' }), (req, res, next) => {
    void (async () => {
        try {
            const signature = req.headers['x-payment-signature'];
            if (!signature || typeof signature !== 'string') {
                res.status(400).json({
                    success: false,
                    error: { code: 'MISSING_SIGNATURE', message: 'x-payment-signature header is required' },
                });
                return;
            }
            await payment_1.paymentService.handleWebhook(req.body, signature);
            // Always acknowledge with 200 — returning anything else causes retries
            res.status(200).json({ received: true });
        }
        catch (err) {
            next(err);
        }
    })();
});
// All remaining routes require authentication
router.use(authenticate_1.authenticate);
// ── POST /payments ────────────────────────────────────────────────────────────
/**
 * Create a payment intent for an order in PAYMENT_PENDING status.
 *
 * The response includes a `clientSecret` the front-end passes to the
 * provider SDK to render the payment UI (e.g. Stripe Elements).
 *
 * Idempotency: supply the same `idempotencyKey` to get the same payment back
 * without creating a duplicate.
 */
router.post('/', (0, authorize_1.authorize)(shared_1.UserRole.AIRLINE, shared_1.UserRole.ADMIN), (req, res, next) => {
    void (async () => {
        try {
            const body = payments_schemas_1.createPaymentSchema.parse(req.body);
            const payment = await payment_1.paymentService.createPayment({
                orderId: body.orderId,
                callerId: req.user.sub,
                callerRole: req.user.role,
                paymentMethod: body.paymentMethod,
                idempotencyKey: body.idempotencyKey,
                ...(body.currency !== undefined ? { currency: body.currency } : {}),
            });
            res.status(201).json((0, response_1.successResponse)({ payment: payment.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
// ── POST /payments/:id/confirm ────────────────────────────────────────────────
/**
 * Confirm / capture a payment intent.
 *
 * Records the provider's authorisation locally.  The order is NOT advanced
 * to PAID here — that happens via the webhook when the provider calls back.
 */
router.post('/:id/confirm', (0, authorize_1.authorize)(shared_1.UserRole.AIRLINE, shared_1.UserRole.ADMIN), (req, res, next) => {
    void (async () => {
        try {
            const { id } = payments_schemas_1.paymentIdParamSchema.parse(req.params);
            const body = payments_schemas_1.confirmPaymentSchema.parse(req.body);
            const payment = await payment_1.paymentService.confirmPayment({
                paymentId: id,
                callerId: req.user.sub,
                callerRole: req.user.role,
                ...(body.paymentMethodToken !== undefined ? { paymentMethodToken: body.paymentMethodToken } : {}),
            });
            res.status(200).json((0, response_1.successResponse)({ payment: payment.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
// ── GET /payments/:id ─────────────────────────────────────────────────────────
/**
 * Retrieve a payment record.
 * Only the payer, payee, or an admin may access a payment.
 */
router.get('/:id', (req, res, next) => {
    void (async () => {
        try {
            const { id } = payments_schemas_1.paymentIdParamSchema.parse(req.params);
            const payment = await payment_1.paymentService.getPayment(id, req.user.sub, req.user.role);
            res.status(200).json((0, response_1.successResponse)({ payment: payment.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
// ── POST /payments/:id/refund ─────────────────────────────────────────────────
/**
 * Initiate a full refund for a captured payment.
 * Only the buyer (airline) or an admin may request a refund.
 */
router.post('/:id/refund', (0, authorize_1.authorize)(shared_1.UserRole.AIRLINE, shared_1.UserRole.ADMIN), (req, res, next) => {
    void (async () => {
        try {
            const { id } = payments_schemas_1.paymentIdParamSchema.parse(req.params);
            const body = payments_schemas_1.refundPaymentSchema.parse(req.body);
            const payment = await payment_1.paymentService.refundPayment({
                paymentId: id,
                callerId: req.user.sub,
                callerRole: req.user.role,
                ...(body.reason !== undefined ? { reason: body.reason } : {}),
            });
            res.status(200).json((0, response_1.successResponse)({ payment: payment.toJSON() }));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=payments.js.map