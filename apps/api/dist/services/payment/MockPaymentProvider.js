"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockPaymentProvider = exports.MockPaymentProvider = void 0;
const crypto_1 = require("crypto");
const env_1 = require("../../config/env");
class MockPaymentProvider {
    /** Controls the outcome of the next confirmIntent call. */
    static nextOutcome = 'success';
    /** HMAC-SHA256 secret used for webhook signature validation. */
    static webhookSecret = env_1.config.PAYMENT_WEBHOOK_SECRET;
    /** Tracks created intents so webhooks can reference them. */
    static intents = new Map();
    static reset() {
        MockPaymentProvider.nextOutcome = 'success';
        MockPaymentProvider.intents.clear();
    }
    // ── IPaymentProvider ───────────────────────────────────────────────────────
    async createIntent(input) {
        const providerPaymentId = `mock_pi_${input.idempotencyKey.slice(0, 12)}`;
        MockPaymentProvider.intents.set(providerPaymentId, {
            amount: input.amount,
            currency: input.currency,
        });
        return {
            providerPaymentId,
            clientSecret: `${providerPaymentId}_secret`,
            raw: {
                id: providerPaymentId,
                status: 'requires_confirmation',
                amount: input.amount,
                currency: input.currency,
                mock: true,
            },
        };
    }
    async confirmIntent(input) {
        const outcome = MockPaymentProvider.nextOutcome;
        // Reset to success after each call so tests that don't set it get default behaviour
        MockPaymentProvider.nextOutcome = 'success';
        if (outcome === 'failure') {
            return {
                success: false,
                transactionReference: `mock_txn_failed_${input.providerPaymentId}`,
                raw: { error: 'card_declined', mock: true },
                failureReason: 'Your card was declined.',
            };
        }
        return {
            success: true,
            transactionReference: `mock_txn_${input.providerPaymentId}`,
            raw: { status: 'succeeded', mock: true },
        };
    }
    async refund(input) {
        return {
            refundReference: `mock_re_${input.providerPaymentId}`,
            raw: { status: 'succeeded', reason: input.reason ?? 'requested_by_customer', mock: true },
        };
    }
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
    /** Maximum age of a valid webhook in seconds (mirrors Stripe's tolerance). */
    static WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;
    parseWebhook(rawBody, signature) {
        // Parse signature header
        const parts = {};
        for (const segment of signature.split(',')) {
            const eq = segment.indexOf('=');
            if (eq !== -1) {
                parts[segment.slice(0, eq)] = segment.slice(eq + 1);
            }
        }
        const timestamp = parts['t'];
        const v1 = parts['v1'];
        if (!timestamp || !v1) {
            throw new Error('INVALID_WEBHOOK_SIGNATURE');
        }
        // Replay protection: reject webhooks older than the tolerance window
        const ts = parseInt(timestamp, 10);
        const now = Math.floor(Date.now() / 1000);
        if (isNaN(ts) || Math.abs(now - ts) > MockPaymentProvider.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
            throw new Error('WEBHOOK_TIMESTAMP_TOO_OLD');
        }
        // Re-compute expected signature
        const expectedHex = (0, crypto_1.createHmac)('sha256', MockPaymentProvider.webhookSecret)
            .update(`${timestamp}.`)
            .update(rawBody)
            .digest('hex');
        const expected = Buffer.from(expectedHex, 'hex');
        const received = Buffer.from(v1, 'hex');
        if (expected.length !== received.length || !(0, crypto_1.timingSafeEqual)(expected, received)) {
            throw new Error('INVALID_WEBHOOK_SIGNATURE');
        }
        // Parse payload
        const payload = JSON.parse(rawBody.toString('utf8'));
        const eventTypeMap = {
            'payment.succeeded': 'payment.succeeded',
            'payment.failed': 'payment.failed',
            'payment.refunded': 'payment.refunded',
        };
        const eventType = eventTypeMap[payload.type];
        if (!eventType) {
            throw new Error(`UNKNOWN_WEBHOOK_EVENT_TYPE: ${payload.type}`);
        }
        return {
            eventType,
            providerPaymentId: payload.providerPaymentId,
            transactionReference: payload.transactionReference,
            raw: payload,
            ...(payload.failureReason ? { failureReason: payload.failureReason } : {}),
        };
    }
    // ── Test helpers ───────────────────────────────────────────────────────────
    /**
     * Generate a valid webhook signature for the given raw body.
     * Use this in tests to produce valid (or intentionally invalid) signatures.
     */
    static sign(rawBody, secret = MockPaymentProvider.webhookSecret) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const hex = (0, crypto_1.createHmac)('sha256', secret)
            .update(`${timestamp}.`)
            .update(rawBody)
            .digest('hex');
        return `t=${timestamp},v1=${hex}`;
    }
}
exports.MockPaymentProvider = MockPaymentProvider;
exports.mockPaymentProvider = new MockPaymentProvider();
//# sourceMappingURL=MockPaymentProvider.js.map