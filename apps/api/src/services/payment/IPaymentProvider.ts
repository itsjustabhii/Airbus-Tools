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

// ── Intent creation ───────────────────────────────────────────────────────────

export interface CreatePaymentIntentInput {
  /** Internal payment record ID (used as idempotency key to the provider). */
  idempotencyKey: string;
  /** Amount in the smallest currency unit (e.g. cents). */
  amount: number;
  currency: string;
  /** Human-readable order reference forwarded to the provider. */
  orderNumber: string;
  /** Provider-level metadata forwarded to the gateway. */
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentResult {
  /** Opaque provider-assigned intent/charge ID — stored as providerPaymentId. */
  providerPaymentId: string;
  /**
   * Provider-specific client secret or redirect URL the front-end needs to
   * complete the payment (e.g. Stripe's `client_secret`).
   */
  clientSecret: string;
  /** Provider-specific raw response for audit purposes. */
  raw: Record<string, unknown>;
}

// ── Confirmation ──────────────────────────────────────────────────────────────

export interface ConfirmPaymentInput {
  providerPaymentId: string;
  /** Provider-specific token returned by the client SDK after card authorisation. */
  paymentMethodToken?: string;
}

export interface ConfirmPaymentResult {
  /** Whether the provider considers the payment fully captured/authorised. */
  success: boolean;
  /** Provider-assigned transaction reference (for reconciliation). */
  transactionReference: string;
  /** Raw gateway response for audit logging. */
  raw: Record<string, unknown>;
  failureReason?: string;
}

// ── Refund ────────────────────────────────────────────────────────────────────

export interface RefundPaymentInput {
  providerPaymentId: string;
  transactionReference: string;
  amount?: number;   // full refund if omitted
  reason?: string;
}

export interface RefundPaymentResult {
  refundReference: string;
  raw: Record<string, unknown>;
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export type WebhookEventType = 'payment.succeeded' | 'payment.failed' | 'payment.refunded';

export interface ParsedWebhookEvent {
  eventType: WebhookEventType;
  providerPaymentId: string;
  transactionReference: string;
  raw: Record<string, unknown>;
  failureReason?: string;
}

// ── Provider interface ────────────────────────────────────────────────────────

export interface IPaymentProvider {
  /**
   * Create a payment intent at the provider.  Returns a client secret the
   * front-end uses to present the payment UI.
   */
  createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;

  /** Confirm / capture a previously-created intent. */
  confirmIntent(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult>;

  /** Refund a captured payment. */
  refund(input: RefundPaymentInput): Promise<RefundPaymentResult>;

  /**
   * Validate and parse a raw webhook payload.
   * Throws if the signature is invalid.
   */
  parseWebhook(rawBody: Buffer, signature: string): ParsedWebhookEvent;
}
