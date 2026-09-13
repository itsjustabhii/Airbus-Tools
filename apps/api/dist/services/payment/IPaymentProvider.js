"use strict";
/**
 * IPaymentProvider — contract every payment backend must satisfy.
 *
 * Concrete implementations:
 *  - MockPaymentProvider   → unit / integration tests (in-memory, controllable outcomes)
 *  - StripePaymentProvider → production (Stripe PaymentIntents)
 *
 * The application never imports a concrete provider directly — it always
 * depends on this interface so providers can be swapped at runtime via the
 * PAYMENT_PROVIDER env var.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=IPaymentProvider.js.map