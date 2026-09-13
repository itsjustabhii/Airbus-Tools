/**
 * MockPaymentProvider — in-memory provider for integration tests.
 *
 * Behaviour is fully controllable via static maps so tests can exercise
 * success, failure, and refund paths without touching a real gateway.
 *
 * Usage (in tests):
 *   MockPaymentProvider.nextOutcome = 'success';         // default
 *   MockPaymentProvider.nextOutcome = 'failure';         // next confirmIntent call fails
 *   MockPaymentProvider.webhookSecret = 'test-secret';
 *   MockPaymentProvider.reset();                         // clear all state
 */
import type { IPaymentProvider, CreatePaymentIntentInput, CreatePaymentIntentResult, ConfirmPaymentInput, ConfirmPaymentResult, RefundPaymentInput, RefundPaymentResult, ParsedWebhookEvent } from './IPaymentProvider';
export declare class MockPaymentProvider implements IPaymentProvider {
    /** Controls the outcome of the next confirmIntent call. */
    static nextOutcome: 'success' | 'failure';
    /** HMAC-SHA256 secret used for webhook signature validation. */
    static webhookSecret: string;
    /** Tracks created intents so webhooks can reference them. */
    private static intents;
    static reset(): void;
    createIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
    confirmIntent(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult>;
    refund(input: RefundPaymentInput): Promise<RefundPaymentResult>;
    /**
     * Validate and parse a webhook event.
     *
     * Signature format: `t=<timestamp>,v1=<hmac-sha256-hex>`
     * Payload HMAC is computed as:  HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
     *
     * This mirrors Stripe's webhook signature scheme and is reproduced
     * identically in `MockPaymentProvider.sign()` so tests can generate
     * valid signatures without coupling to implementation details.
     */
    parseWebhook(rawBody: Buffer, signature: string): ParsedWebhookEvent;
    /**
     * Generate a valid webhook signature for the given raw body.
     * Use this in tests to produce valid (or intentionally invalid) signatures.
     */
    static sign(rawBody: Buffer, secret?: string): string;
}
export declare const mockPaymentProvider: MockPaymentProvider;
//# sourceMappingURL=MockPaymentProvider.d.ts.map