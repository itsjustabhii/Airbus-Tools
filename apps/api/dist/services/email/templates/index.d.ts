/**
 * Email template registry.
 *
 * Each template function receives a strongly-typed data payload and returns a
 * `{ subject, html, text }` triple.  The worker resolves the correct template
 * from the job name and passes the rendered output to the email adapter.
 *
 * Design rules:
 *  - Templates are pure functions (no I/O, no imports from other services).
 *  - HTML is intentionally simple inline-styled content — no external CSS.
 *  - A plain-text fallback is always provided for accessibility / spam score.
 */
export interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}
export interface WelcomeVars {
    recipientName: string;
    userId: string;
}
export declare function renderWelcome(v: WelcomeVars): RenderedEmail;
export interface OrderRequestVars {
    recipientName: string;
    orderNumber: string;
    orderId: string;
    totalAmount: number;
    currency: string;
}
export declare function renderOrderRequest(v: OrderRequestVars): RenderedEmail;
export interface OrderAcceptedVars {
    recipientName: string;
    orderNumber: string;
    orderId: string;
    totalAmount: number;
    currency: string;
}
export declare function renderOrderAccepted(v: OrderAcceptedVars): RenderedEmail;
export interface OrderRejectedVars {
    recipientName: string;
    orderNumber: string;
    orderId: string;
    rejectionReason: string;
}
export declare function renderOrderRejected(v: OrderRejectedVars): RenderedEmail;
export interface PaymentConfirmationVars {
    recipientName: string;
    paymentNumber: string;
    paymentId: string;
    orderId: string;
    orderNumber: string;
    amount: number;
    currency: string;
}
export declare function renderPaymentConfirmation(v: PaymentConfirmationVars): RenderedEmail;
export interface PasswordChangedVars {
    recipientName: string;
    userId: string;
    changedAt: string;
}
export declare function renderPasswordChanged(v: PasswordChangedVars): RenderedEmail;
export interface NotificationEmailVars {
    recipientName: string;
    subject: string;
    message: string;
    referenceType?: string | undefined;
    referenceId?: string | undefined;
}
export declare function renderNotification(v: NotificationEmailVars): RenderedEmail;
//# sourceMappingURL=index.d.ts.map