/**
 * Integration tests for EmailService (Phase 9).
 *
 * Strategy:
 *  - Inject MockEmailAdapter into every EmailService under test so no real
 *    network calls are made and no AWS credentials are required.
 *  - Tests assert on the captured `MockEmailAdapter.sent` array to verify that
 *    the correct subject, recipient, and body keywords are used for each email
 *    type.
 *  - Idempotency is verified by calling send() twice with the same jobId and
 *    confirming the adapter was called only once.
 *  - The unknown-job-name guard is verified to throw.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { EmailService, processedJobIds } from './EmailService';
import { MockEmailAdapter } from './MockEmailAdapter';
import type {
  SendWelcomeData,
  SendOrderRequestData,
  SendOrderAcceptedData,
  SendOrderRejectedData,
  SendPaymentConfirmationData,
  SendPasswordChangedData,
  SendNotificationEmailData,
} from '../../jobs/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

let mock: MockEmailAdapter;
let service: EmailService;

beforeEach(() => {
  // Fresh adapter + service for every test
  mock = new MockEmailAdapter();
  service = new EmailService(mock);
  // Clear shared idempotency store so tests don't bleed into each other
  processedJobIds.clear();
});

// ── welcome ───────────────────────────────────────────────────────────────────

describe('send-welcome', () => {
  const data: { name: 'send-welcome' } & SendWelcomeData = {
    name: 'send-welcome',
    jobId: 'job-welcome-001',
    to: 'jane@airline.com',
    recipientName: 'Jane',
    userId: 'user-abc',
  };

  it('sends a welcome email with the correct subject', async () => {
    await service.send(data);
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0]!.to).toBe('jane@airline.com');
    expect(mock.sent[0]!.subject).toContain('Welcome');
  });

  it('includes recipient name in the HTML body', async () => {
    await service.send(data);
    expect(mock.sent[0]!.html).toContain('Jane');
  });
});

// ── order-request ─────────────────────────────────────────────────────────────

describe('send-order-request', () => {
  const data: { name: 'send-order-request' } & SendOrderRequestData = {
    name: 'send-order-request',
    jobId: 'job-order-req-001',
    to: 'buyer@airline.com',
    recipientName: 'Alice',
    orderNumber: 'ORD-2024-ABCD1234',
    orderId: 'order-id-1',
    totalAmount: 15000,
    currency: 'USD',
    supplierTo: 'supplier@parts.com',
    supplierName: 'Bob Supplier',
  };

  it('sends to the buyer with the order number in the subject', async () => {
    await service.send(data);
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0]!.subject).toContain('ORD-2024-ABCD1234');
  });

  it('includes total amount in the HTML', async () => {
    await service.send(data);
    expect(mock.sent[0]!.html).toContain('15000.00');
  });
});

// ── order-accepted ────────────────────────────────────────────────────────────

describe('send-order-accepted', () => {
  const data: { name: 'send-order-accepted' } & SendOrderAcceptedData = {
    name: 'send-order-accepted',
    jobId: 'job-order-acc-001',
    to: 'buyer@airline.com',
    recipientName: 'Alice',
    orderNumber: 'ORD-2024-ABCD1234',
    orderId: 'order-id-1',
    totalAmount: 15000,
    currency: 'USD',
  };

  it('sends with an "Accepted" subject', async () => {
    await service.send(data);
    expect(mock.sent[0]!.subject).toContain('Accepted');
    expect(mock.sent[0]!.subject).toContain('ORD-2024-ABCD1234');
  });

  it('HTML body contains the "Accepted" badge', async () => {
    await service.send(data);
    expect(mock.sent[0]!.html.toLowerCase()).toContain('accepted');
  });
});

// ── order-rejected ────────────────────────────────────────────────────────────

describe('send-order-rejected', () => {
  const data: { name: 'send-order-rejected' } & SendOrderRejectedData = {
    name: 'send-order-rejected',
    jobId: 'job-order-rej-001',
    to: 'buyer@airline.com',
    recipientName: 'Alice',
    orderNumber: 'ORD-2024-ABCD1234',
    orderId: 'order-id-1',
    rejectionReason: 'Part unavailable',
  };

  it('sends with a "Rejected" subject', async () => {
    await service.send(data);
    expect(mock.sent[0]!.subject).toContain('Rejected');
  });

  it('includes rejection reason in HTML', async () => {
    await service.send(data);
    expect(mock.sent[0]!.html).toContain('Part unavailable');
  });

  it('includes rejection reason in plain text', async () => {
    await service.send(data);
    expect(mock.sent[0]!.text).toContain('Part unavailable');
  });
});

// ── payment-confirmation ──────────────────────────────────────────────────────

describe('send-payment-confirmation', () => {
  const data: { name: 'send-payment-confirmation' } & SendPaymentConfirmationData = {
    name: 'send-payment-confirmation',
    jobId: 'job-pay-001',
    to: 'buyer@airline.com',
    recipientName: 'Alice',
    paymentNumber: 'PAY-2024-XYZ',
    paymentId: 'pay-id-1',
    orderId: 'order-id-1',
    orderNumber: 'ORD-2024-ABCD1234',
    amount: 15000,
    currency: 'USD',
  };

  it('sends with payment number in the subject', async () => {
    await service.send(data);
    expect(mock.sent[0]!.subject).toContain('PAY-2024-XYZ');
  });

  it('includes order number and amount in HTML', async () => {
    await service.send(data);
    expect(mock.sent[0]!.html).toContain('ORD-2024-ABCD1234');
    expect(mock.sent[0]!.html).toContain('15000.00');
  });
});

// ── password-changed ──────────────────────────────────────────────────────────

describe('send-password-changed', () => {
  const data: { name: 'send-password-changed' } & SendPasswordChangedData = {
    name: 'send-password-changed',
    jobId: 'job-pwd-001',
    to: 'user@airline.com',
    recipientName: 'Alice',
    userId: 'user-abc',
    changedAt: '2024-06-01T12:00:00.000Z',
  };

  it('sends with "Password" in the subject', async () => {
    await service.send(data);
    expect(mock.sent[0]!.subject.toLowerCase()).toContain('password');
  });

  it('includes changedAt timestamp in HTML', async () => {
    await service.send(data);
    expect(mock.sent[0]!.html).toContain('2024-06-01T12:00:00.000Z');
  });
});

// ── notification ──────────────────────────────────────────────────────────────

describe('send-notification', () => {
  const data: { name: 'send-notification' } & SendNotificationEmailData = {
    name: 'send-notification',
    jobId: 'job-notif-001',
    to: 'user@airline.com',
    recipientName: 'Alice',
    subject: 'Important system update',
    message: 'Maintenance window scheduled for midnight.',
    referenceType: 'system',
    referenceId: 'maint-42',
  };

  it('uses the provided subject', async () => {
    await service.send(data);
    expect(mock.sent[0]!.subject).toBe('Important system update');
  });

  it('includes the message text in the HTML', async () => {
    await service.send(data);
    expect(mock.sent[0]!.html).toContain('Maintenance window scheduled for midnight');
  });

  it('includes reference metadata in HTML', async () => {
    await service.send(data);
    expect(mock.sent[0]!.html).toContain('maint-42');
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('idempotency', () => {
  const data: { name: 'send-welcome' } & SendWelcomeData = {
    name: 'send-welcome',
    jobId: 'job-idempotent-999',
    to: 'jane@airline.com',
    recipientName: 'Jane',
    userId: 'user-abc',
  };

  it('sends the email only once even when called twice with the same jobId', async () => {
    await service.send(data);
    await service.send(data); // second call should be skipped
    expect(mock.sent).toHaveLength(1);
  });
});

// ── Unknown job name guard ────────────────────────────────────────────────────

describe('unknown job name', () => {
  it('throws an error for an unrecognised job name', async () => {
    // Force an unknown name through the type system
    const badData = { name: 'send-smoke-signal', jobId: 'job-bad-001' } as unknown as Parameters<typeof service.send>[0];
    await expect(service.send(badData)).rejects.toThrow('Unknown email job name: send-smoke-signal');
  });
});

// ── Adapter receives correct fields ──────────────────────────────────────────

describe('adapter contract', () => {
  it('passes the jobId as idempotencyKey to the adapter', async () => {
    await service.send({
      name: 'send-welcome',
      jobId: 'idem-key-abc',
      to: 'x@x.com',
      recipientName: 'X',
      userId: 'u1',
    });
    expect(mock.sent[0]!.idempotencyKey).toBe('idem-key-abc');
  });

  it('always sets a from address', async () => {
    await service.send({
      name: 'send-welcome',
      jobId: 'from-test',
      to: 'x@x.com',
      recipientName: 'X',
      userId: 'u1',
    });
    expect(mock.sent[0]!.from).toBeTruthy();
  });

  it('html and text are both populated', async () => {
    await service.send({
      name: 'send-welcome',
      jobId: 'body-test',
      to: 'x@x.com',
      recipientName: 'X',
      userId: 'u1',
    });
    expect(mock.sent[0]!.html.length).toBeGreaterThan(50);
    expect(mock.sent[0]!.text.length).toBeGreaterThan(10);
  });
});
