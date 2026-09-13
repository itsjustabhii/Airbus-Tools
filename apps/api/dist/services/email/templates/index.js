"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderWelcome = renderWelcome;
exports.renderOrderRequest = renderOrderRequest;
exports.renderOrderAccepted = renderOrderAccepted;
exports.renderOrderRejected = renderOrderRejected;
exports.renderPaymentConfirmation = renderPaymentConfirmation;
exports.renderPasswordChanged = renderPasswordChanged;
exports.renderNotification = renderNotification;
// ── Helpers ───────────────────────────────────────────────────────────────────
function wrap(body, title) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:6px;border:1px solid #e5e7eb">
      <tr><td style="padding:32px 40px">${body}</td></tr>
      <tr><td style="padding:16px 40px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center">
        Airbus Tools · This message was sent automatically, please do not reply.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
function h1(text) {
    return `<h1 style="margin:0 0 16px;font-size:22px;color:#1f2328">${text}</h1>`;
}
function p(text) {
    return `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6">${text}</p>`;
}
function badge(text, color = '#3b82d4') {
    return `<span style="display:inline-block;padding:4px 10px;border-radius:4px;background:${color};color:#fff;font-size:13px;font-weight:600">${text}</span>`;
}
function dl(rows) {
    const items = rows
        .map(([label, value]) => `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:160px">${label}</td>` +
        `<td style="padding:6px 0;font-size:14px;color:#1f2328;font-weight:600">${value}</td></tr>`)
        .join('');
    return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0">${items}</table>`;
}
function renderWelcome(v) {
    const subject = 'Welcome to Airbus Tools';
    const html = wrap(h1('Welcome aboard, ' + v.recipientName + '!') +
        p('Your Airbus Tools account has been created successfully.') +
        p('You can now browse the parts catalogue, place orders, and track your deliveries from a single dashboard.') +
        p('If you have any questions, reach out to our support team at any time.'), subject);
    const text = `Welcome to Airbus Tools, ${v.recipientName}!\n\n` +
        `Your account (ID: ${v.userId}) has been created successfully.\n` +
        `Log in at https://airbus-tools.example.com to get started.`;
    return { subject, html, text };
}
function renderOrderRequest(v) {
    const subject = `Order Request Received — ${v.orderNumber}`;
    const html = wrap(h1('Order Request Submitted') +
        p(`Hi ${v.recipientName}, your order request has been received and is awaiting supplier review.`) +
        dl([
            ['Order Number', v.orderNumber],
            ['Total Amount', `${v.currency} ${v.totalAmount.toFixed(2)}`],
            ['Status', 'Pending Review'],
        ]) +
        p("We'll notify you as soon as the supplier responds."), subject);
    const text = `Hi ${v.recipientName},\n\nYour order ${v.orderNumber} has been submitted.\n` +
        `Total: ${v.currency} ${v.totalAmount.toFixed(2)}\nStatus: Pending Review\n`;
    return { subject, html, text };
}
function renderOrderAccepted(v) {
    const subject = `Order Accepted — ${v.orderNumber}`;
    const html = wrap(h1('Your Order Has Been Accepted') +
        p(`Hi ${v.recipientName}, great news — your order has been accepted by the supplier.`) +
        dl([
            ['Order Number', v.orderNumber],
            ['Total Amount', `${v.currency} ${v.totalAmount.toFixed(2)}`],
            ['Status', badge('Accepted', '#16a34a')],
        ]) +
        p('Proceed to payment to complete your order.'), subject);
    const text = `Hi ${v.recipientName},\n\nYour order ${v.orderNumber} has been accepted.\n` +
        `Total: ${v.currency} ${v.totalAmount.toFixed(2)}\n`;
    return { subject, html, text };
}
function renderOrderRejected(v) {
    const subject = `Order Rejected — ${v.orderNumber}`;
    const html = wrap(h1('Your Order Could Not Be Fulfilled') +
        p(`Hi ${v.recipientName}, unfortunately your order has been rejected by the supplier.`) +
        dl([
            ['Order Number', v.orderNumber],
            ['Status', badge('Rejected', '#dc2626')],
            ['Reason', v.rejectionReason],
        ]) +
        p('You may submit a new order at any time. Contact support if you need assistance.'), subject);
    const text = `Hi ${v.recipientName},\n\nYour order ${v.orderNumber} has been rejected.\n` +
        `Reason: ${v.rejectionReason}\n`;
    return { subject, html, text };
}
function renderPaymentConfirmation(v) {
    const subject = `Payment Confirmed — ${v.paymentNumber}`;
    const html = wrap(h1('Payment Confirmed') +
        p(`Hi ${v.recipientName}, your payment has been processed successfully.`) +
        dl([
            ['Payment Number', v.paymentNumber],
            ['Order Number', v.orderNumber],
            ['Amount Paid', `${v.currency} ${v.amount.toFixed(2)}`],
            ['Status', badge('Paid', '#16a34a')],
        ]) +
        p('A receipt has been attached to your account. Thank you for your business.'), subject);
    const text = `Hi ${v.recipientName},\n\nPayment ${v.paymentNumber} confirmed.\n` +
        `Order: ${v.orderNumber}  Amount: ${v.currency} ${v.amount.toFixed(2)}\n`;
    return { subject, html, text };
}
function renderPasswordChanged(v) {
    const subject = 'Your Password Was Changed';
    const html = wrap(h1('Password Changed Successfully') +
        p(`Hi ${v.recipientName}, your Airbus Tools password was changed on ${v.changedAt}.`) +
        p('If you did not make this change, please contact support immediately and reset your password.'), subject);
    const text = `Hi ${v.recipientName},\n\nYour password was changed at ${v.changedAt}.\n` +
        `If this was not you, please contact support immediately.\n`;
    return { subject, html, text };
}
function renderNotification(v) {
    const html = wrap(h1(v.subject) +
        p(`Hi ${v.recipientName},`) +
        p(v.message) +
        (v.referenceType != null && v.referenceId != null
            ? dl([
                ['Reference Type', v.referenceType],
                ['Reference ID', v.referenceId],
            ])
            : ''), v.subject);
    const text = `Hi ${v.recipientName},\n\n${v.message}\n`;
    return { subject: v.subject, html, text };
}
//# sourceMappingURL=index.js.map