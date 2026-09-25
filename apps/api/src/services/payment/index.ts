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

import { config } from '../../config/env';

import type { IPaymentProvider } from './IPaymentProvider';
import { MockPaymentProvider } from './MockPaymentProvider';
import { PaymentService } from './paymentService';

function buildProvider(): IPaymentProvider {
  const providerName = (config as Record<string, unknown>)['PAYMENT_PROVIDER'] as string | undefined ?? 'mock';

  switch (providerName) {
    case 'mock':
    default:
      return new MockPaymentProvider();
  }
}

export const paymentService = new PaymentService(buildProvider());

export { PaymentService } from './paymentService';
export type { CreatePaymentInput, ConfirmPaymentInput, RefundPaymentInput } from './paymentService';
export type { IPaymentProvider } from './IPaymentProvider';
export { MockPaymentProvider } from './MockPaymentProvider';
export { assertPaymentTransition, isPaymentTerminal, PAYMENT_TERMINAL_STATUSES } from './paymentStateMachine';
