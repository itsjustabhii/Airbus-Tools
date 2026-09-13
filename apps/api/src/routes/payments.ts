/**
 * Payments router — Phase 10
 *
 * Routes:
 *   POST   /payments              — create a payment intent  (AIRLINE)
 *   POST   /payments/:id/confirm  — confirm / capture intent (AIRLINE)
 *   GET    /payments/:id          — fetch payment details    (AIRLINE | SUPPLIER | ADMIN)
 *   POST   /payments/:id/refund   — initiate refund          (AIRLINE | ADMIN)
 *   POST   /payments/webhook      — provider webhook         (no auth — sig-validated)
 *
 * The webhook route intentionally sits before the `authenticate` middleware
 * so raw Buffer body parsing is applied to that path only.
 *
 * IMPORTANT: The `express.raw()` body parser for the webhook must be
 * registered in app.ts BEFORE `express.json()`, OR the webhook route must
 * use its own raw parser as done here.
 */
import type { Router, Request, Response, NextFunction } from 'express';
import { Router as createRouter } from 'express';
import express from 'express';

import { UserRole } from '@airbus-tools/shared';

import { successResponse } from '../core/response';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { paymentService } from '../services/payment';

import {
  createPaymentSchema,
  confirmPaymentSchema,
  refundPaymentSchema,
  paymentIdParamSchema,
} from './payments.schemas';

const router: Router = createRouter();

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
router.post(
  '/webhook',
  express.raw({ type: '*/*', limit: '256kb' }),
  (req: Request, res: Response, next: NextFunction) => {
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

        await paymentService.handleWebhook(req.body as Buffer, signature);

        // Always acknowledge with 200 — returning anything else causes retries
        res.status(200).json({ received: true });
      } catch (err) {
        next(err);
      }
    })();
  },
);

// All remaining routes require authentication
router.use(authenticate);

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
router.post(
  '/',
  authorize(UserRole.AIRLINE, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const body = createPaymentSchema.parse(req.body);

        const payment = await paymentService.createPayment({
          orderId:        body.orderId,
          callerId:       req.user!.sub,
          callerRole:     req.user!.role as UserRole,
          paymentMethod:  body.paymentMethod,
          idempotencyKey: body.idempotencyKey,
          ...(body.currency !== undefined ? { currency: body.currency } : {}),
        });

        res.status(201).json(successResponse({ payment: payment.toJSON() }));
      } catch (err) {
        next(err);
      }
    })();
  },
);

// ── POST /payments/:id/confirm ────────────────────────────────────────────────
/**
 * Confirm / capture a payment intent.
 *
 * Records the provider's authorisation locally.  The order is NOT advanced
 * to PAID here — that happens via the webhook when the provider calls back.
 */
router.post(
  '/:id/confirm',
  authorize(UserRole.AIRLINE, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const { id } = paymentIdParamSchema.parse(req.params);
        const body    = confirmPaymentSchema.parse(req.body);

        const payment = await paymentService.confirmPayment({
          paymentId:          id,
          callerId:           req.user!.sub,
          callerRole:         req.user!.role as UserRole,
          ...(body.paymentMethodToken !== undefined ? { paymentMethodToken: body.paymentMethodToken } : {}),
        });

        res.status(200).json(successResponse({ payment: payment.toJSON() }));
      } catch (err) {
        next(err);
      }
    })();
  },
);

// ── GET /payments/:id ─────────────────────────────────────────────────────────
/**
 * Retrieve a payment record.
 * Only the payer, payee, or an admin may access a payment.
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const { id } = paymentIdParamSchema.parse(req.params);

      const payment = await paymentService.getPayment(
        id,
        req.user!.sub,
        req.user!.role as UserRole,
      );

      res.status(200).json(successResponse({ payment: payment.toJSON() }));
    } catch (err) {
      next(err);
    }
  })();
});

// ── POST /payments/:id/refund ─────────────────────────────────────────────────
/**
 * Initiate a full refund for a captured payment.
 * Only the buyer (airline) or an admin may request a refund.
 */
router.post(
  '/:id/refund',
  authorize(UserRole.AIRLINE, UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const { id } = paymentIdParamSchema.parse(req.params);
        const body    = refundPaymentSchema.parse(req.body);

        const payment = await paymentService.refundPayment({
          paymentId:  id,
          callerId:   req.user!.sub,
          callerRole: req.user!.role as UserRole,
          ...(body.reason !== undefined ? { reason: body.reason } : {}),
        });

        res.status(200).json(successResponse({ payment: payment.toJSON() }));
      } catch (err) {
        next(err);
      }
    })();
  },
);

export { router as paymentsRouter };
