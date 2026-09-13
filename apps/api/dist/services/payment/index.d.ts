/**
 * Payment service index — exports the singleton PaymentService instance.
 *
 * The active provider is selected by PAYMENT_PROVIDER env var:
 *   - 'mock'  → MockPaymentProvider (default for test / local)
 *
 * Adding a new provider (e.g. Stripe):
 *   1. Implement IPaymentProvider in StripePaymentProvider.ts
 *   2. Add 'stripe' to the switch below
 *   3. Set PAYMENT_PROVIDER=stripe in production env
 */
import { PaymentService } from './paymentService';
export declare const paymentService: PaymentService;
export { PaymentService } from './paymentService';
export type { CreatePaymentInput, ConfirmPaymentInput, RefundPaymentInput } from './paymentService';
export type { IPaymentProvider } from './IPaymentProvider';
export { MockPaymentProvider } from './MockPaymentProvider';
export { assertPaymentTransition, isPaymentTerminal, PAYMENT_TERMINAL_STATUSES } from './paymentStateMachine';
//# sourceMappingURL=index.d.ts.map