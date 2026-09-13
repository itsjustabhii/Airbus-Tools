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
import type { Router } from 'express';
declare const router: Router;
export { router as paymentsRouter };
//# sourceMappingURL=payments.d.ts.map