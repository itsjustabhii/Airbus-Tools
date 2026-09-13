import { z } from 'zod';
import { PaymentMethod } from '@airbus-tools/shared';
export declare const createPaymentSchema: z.ZodObject<{
    orderId: z.ZodString;
    paymentMethod: z.ZodNativeEnum<typeof PaymentMethod>;
    currency: z.ZodOptional<z.ZodString>;
    /**
     * Caller-supplied UUID for idempotency.
     * Two requests with the same key return the existing payment.
     */
    idempotencyKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    paymentMethod: PaymentMethod;
    idempotencyKey: string;
    currency?: string | undefined;
}, {
    orderId: string;
    paymentMethod: PaymentMethod;
    idempotencyKey: string;
    currency?: string | undefined;
}>;
export type CreatePaymentBody = z.infer<typeof createPaymentSchema>;
export declare const confirmPaymentSchema: z.ZodObject<{
    /**
     * Provider SDK token returned after the client-side payment UI completes
     * (e.g. Stripe's PaymentMethod ID).  Optional for mock provider.
     */
    paymentMethodToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    paymentMethodToken?: string | undefined;
}, {
    paymentMethodToken?: string | undefined;
}>;
export type ConfirmPaymentBody = z.infer<typeof confirmPaymentSchema>;
export declare const refundPaymentSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
}, {
    reason?: string | undefined;
}>;
export type RefundPaymentBody = z.infer<typeof refundPaymentSchema>;
export declare const paymentIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
//# sourceMappingURL=payments.schemas.d.ts.map