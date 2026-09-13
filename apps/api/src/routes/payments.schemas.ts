import { z } from 'zod';
import { PaymentMethod } from '@airbus-tools/shared';

// ── POST /payments ────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  orderId:        z.string().trim().min(1, 'orderId is required'),
  paymentMethod:  z.nativeEnum(PaymentMethod),
  currency:       z.string().trim().length(3).toUpperCase().optional(),
  /**
   * Caller-supplied UUID for idempotency.
   * Two requests with the same key return the existing payment.
   */
  idempotencyKey: z.string().trim().uuid('idempotencyKey must be a UUID v4'),
});

export type CreatePaymentBody = z.infer<typeof createPaymentSchema>;

// ── POST /payments/:id/confirm ────────────────────────────────────────────────

export const confirmPaymentSchema = z.object({
  /**
   * Provider SDK token returned after the client-side payment UI completes
   * (e.g. Stripe's PaymentMethod ID).  Optional for mock provider.
   */
  paymentMethodToken: z.string().trim().min(1).optional(),
});

export type ConfirmPaymentBody = z.infer<typeof confirmPaymentSchema>;

// ── POST /payments/:id/refund ─────────────────────────────────────────────────

export const refundPaymentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type RefundPaymentBody = z.infer<typeof refundPaymentSchema>;

// ── Params ────────────────────────────────────────────────────────────────────

export const paymentIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid payment ID — must be a 24-character hex ObjectId'),
});
