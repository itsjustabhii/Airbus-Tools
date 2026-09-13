/**
 * Integration tests for Phase 10: Payments
 *
 * Covers:
 *  - Successful payment flow (create → confirm → webhook → order PAID)
 *  - Failed payment (provider declines → payment FAILED)
 *  - Duplicate webhook delivery (idempotent no-op)
 *  - Invalid webhook signature (rejected with 400)
 *  - Safe retry (double-confirm is a no-op)
 *  - Refund flow
 *  - Unauthorized order access (third-party cannot create payment)
 *  - Frontend cannot set order to PAID via PATCH /orders/:id/status
 *  - GET /payments/:id scoping
 */

import bcrypt from 'bcrypt';
import supertest from 'supertest';
import {
  describe, it, expect,
  beforeAll, afterAll, beforeEach, afterEach,
} from 'vitest';

import { OrderStatus, PaymentMethod, PaymentStatus, UserRole, UserStatus, ProductStatus, ProductCategory, ProductCondition } from '@airbus-tools/shared';

import { createApp } from '../app';
import { signToken } from '../auth/jwt';
import { AUTH_COOKIE_NAME } from '../auth/service';
import { UserModel } from '../database/models/User';
import { ProductModel } from '../database/models/Product';
import { OrderModel } from '../database/models/Order';
import { PaymentModel } from '../database/models/Payment';
import { setupTestDB, teardownTestDB, clearTestDB } from '../database/test-utils';
import { MockPaymentProvider } from '../services/payment/MockPaymentProvider';

const app     = createApp();
const request = supertest(app);

// ── DB lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => { await setupTestDB(); });
afterAll(async ()  => { await teardownTestDB(); });
beforeEach(async () => {
  await clearTestDB();
  MockPaymentProvider.reset();
});
afterEach(() => {
  MockPaymentProvider.reset();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

async function createUser(overrides: Record<string, unknown> = {}) {
  const hash = await bcrypt.hash('Password1', 10);
  return UserModel.create({
    email:         'user@test.com',
    firstName:     'Test',
    lastName:      'User',
    passwordHash:  hash,
    role:          UserRole.AIRLINE,
    status:        UserStatus.ACTIVE,
    ...overrides,
  });
}

async function createProduct(sellerId: string, overrides: Record<string, unknown> = {}) {
  return ProductModel.create({
    sellerId,
    title:             'Titanium Bolt M8',
    partNumber:        `PN-${Date.now()}`,
    description:       'High-strength titanium bolt',
    category:          ProductCategory.FASTENERS,
    condition:         ProductCondition.NEW,
    status:            ProductStatus.ACTIVE,
    price:             250,
    currency:          'USD',
    quantityAvailable: 1000,
    minimumOrderQuantity: 1,
    certifications:    [],
    tags:              [],
    mediaUrls:         [],
    ...overrides,
  });
}

function cookie(token: string): string {
  return `${AUTH_COOKIE_NAME}=${token}`;
}

function tokenFor(user: { _id: unknown; email: string; role: string }): string {
  return signToken({ sub: String(user._id), email: user.email, role: user.role });
}

const validAddress = {
  street:     '1 Aviation Blvd',
  city:       'Los Angeles',
  postalCode: '90045',
  country:    'US',
};

// ── Full fixture: airline + supplier + accepted order in PAYMENT_PENDING ──────

interface PaymentFixture {
  airline:       Awaited<ReturnType<typeof createUser>>;
  supplier:      Awaited<ReturnType<typeof createUser>>;
  product:       Awaited<ReturnType<typeof createProduct>>;
  airlineToken:  string;
  supplierToken: string;
  orderId:       string;
  orderNumber:   string;
}

async function createPaymentPendingOrder(): Promise<PaymentFixture> {
  const airline  = await createUser({ email: 'airline@test.com', role: UserRole.AIRLINE });
  const supplier = await createUser({ email: 'supplier@test.com', role: UserRole.SUPPLIER });
  const product  = await createProduct(String(supplier._id));

  const airlineToken  = tokenFor({ _id: airline._id, email: airline.email, role: airline.role });
  const supplierToken = tokenFor({ _id: supplier._id, email: supplier.email, role: supplier.role });

  // Create order (PENDING)
  const createRes = await request
    .post('/api/v1/orders')
    .set('Cookie', cookie(airlineToken))
    .send({ items: [{ productId: String(product._id), quantity: 2 }], shippingAddress: validAddress });
  expect(createRes.status).toBe(201);
  const orderId = createRes.body.data.order.id as string;

  // PENDING → ACCEPTED (supplier)
  await request
    .patch(`/api/v1/orders/${orderId}/status`)
    .set('Cookie', cookie(supplierToken))
    .send({ status: OrderStatus.ACCEPTED })
    .expect(200);

  // ACCEPTED → PAYMENT_PENDING (airline)
  const res = await request
    .patch(`/api/v1/orders/${orderId}/status`)
    .set('Cookie', cookie(airlineToken))
    .send({ status: OrderStatus.PAYMENT_PENDING })
    .expect(200);

  return {
    airline,
    supplier,
    product,
    airlineToken,
    supplierToken,
    orderId,
    orderNumber: (res.body.data.order as { orderNumber: string }).orderNumber,
  };
}

/**
 * Build a valid webhook payload Buffer + HMAC-SHA256 signature header.
 */
function buildWebhook(
  eventType: string,
  providerPaymentId: string,
  transactionReference: string,
  extra: Record<string, unknown> = {},
): { body: Buffer; signature: string } {
  const body = Buffer.from(
    JSON.stringify({ type: eventType, providerPaymentId, transactionReference, ...extra }),
    'utf8',
  );
  const signature = MockPaymentProvider.sign(body);
  return { body, signature };
}

// ── POST /payments — create ───────────────────────────────────────────────────

describe('POST /api/v1/payments — create payment', () => {
  it('creates a payment intent for a PAYMENT_PENDING order', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const res = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({
        orderId,
        paymentMethod:  PaymentMethod.CREDIT_CARD,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.status).toBe(PaymentStatus.PENDING);
    expect(res.body.data.payment.providerPaymentId).toBeTruthy();
    expect(res.body.data.payment.orderId).toBe(orderId);
  });

  it('returns the same payment for duplicate idempotencyKey (idempotent)', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const key = '550e8400-e29b-41d4-a716-446655440001';
    const first = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: key });
    expect(first.status).toBe(201);

    const second = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: key });
    expect(second.status).toBe(201);

    expect(first.body.data.payment.id).toBe(second.body.data.payment.id);
  });

  it('rejects a payment for an order not in PAYMENT_PENDING status', async () => {
    const { airlineToken, orderId, supplierToken } = await createPaymentPendingOrder();

    // Revert order to ACCEPTED by creating a fresh fixture in ACCEPTED state
    // Instead: use an order that's still in PENDING state
    const airline  = await createUser({ email: 'airline2@test.com', role: UserRole.AIRLINE });
    const supplier = await createUser({ email: 'supplier2@test.com', role: UserRole.SUPPLIER });
    const product  = await createProduct(String(supplier._id));
    const t = tokenFor({ _id: airline._id, email: airline.email, role: airline.role });

    const orderRes = await request
      .post('/api/v1/orders')
      .set('Cookie', cookie(t))
      .send({ items: [{ productId: String(product._id), quantity: 1 }], shippingAddress: validAddress })
      .expect(201);

    // Order is PENDING — not PAYMENT_PENDING
    const res = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(t))
      .send({
        orderId:        orderRes.body.data.order.id as string,
        paymentMethod:  PaymentMethod.CREDIT_CARD,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440002',
      });

    expect(res.status).toBe(409);

    // suppress unused var warning
    void airlineToken; void orderId; void supplierToken;
  });

  it('rejects a payment for an order the caller does not own', async () => {
    const { orderId } = await createPaymentPendingOrder();

    // A different airline tries to pay this order
    const otherAirline = await createUser({ email: 'other@airline.com', role: UserRole.AIRLINE });
    const otherToken   = tokenFor({ _id: otherAirline._id, email: otherAirline.email, role: otherAirline.role });

    const res = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(otherToken))
      .send({
        orderId,
        paymentMethod:  PaymentMethod.CREDIT_CARD,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440003',
      });

    // Should get 404 (participant check) or 403
    expect([403, 404]).toContain(res.status);
  });

  it('returns 401 without auth', async () => {
    await request.post('/api/v1/payments').send({}).expect(401);
  });

  it('returns 403 for supplier role', async () => {
    const { supplierToken, orderId } = await createPaymentPendingOrder();

    await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(supplierToken))
      .send({
        orderId,
        paymentMethod:  PaymentMethod.CREDIT_CARD,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440004',
      })
      .expect(403);
  });
});

// ── POST /payments/:id/confirm ────────────────────────────────────────────────

describe('POST /api/v1/payments/:id/confirm — confirm payment', () => {
  it('marks payment AUTHORIZED on provider success', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440010' })
      .expect(201);

    const paymentId = createRes.body.data.payment.id as string;

    MockPaymentProvider.nextOutcome = 'success';
    const confirmRes = await request
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Cookie', cookie(airlineToken))
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.payment.status).toBe(PaymentStatus.AUTHORIZED);
    expect(confirmRes.body.data.payment.transactionReference).toBeTruthy();
  });

  it('marks payment FAILED when provider declines', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440011' })
      .expect(201);

    const paymentId = createRes.body.data.payment.id as string;

    MockPaymentProvider.nextOutcome = 'failure';
    const confirmRes = await request
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Cookie', cookie(airlineToken))
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.payment.status).toBe(PaymentStatus.FAILED);
    expect(confirmRes.body.data.payment.failureReason).toBeTruthy();
  });

  it('is idempotent — double confirm returns current state without calling provider twice', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440012' })
      .expect(201);
    const paymentId = createRes.body.data.payment.id as string;

    MockPaymentProvider.nextOutcome = 'success';
    await request
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Cookie', cookie(airlineToken))
      .send({})
      .expect(200);

    // Second confirm — provider outcome is reset to 'success' but the call
    // should be intercepted before reaching the provider
    MockPaymentProvider.nextOutcome = 'failure'; // would fail if provider called
    const secondRes = await request
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Cookie', cookie(airlineToken))
      .send({});

    expect(secondRes.status).toBe(200);
    // Status unchanged from first confirm
    expect(secondRes.body.data.payment.status).toBe(PaymentStatus.AUTHORIZED);
  });

  it('rejects confirm by a non-payer', async () => {
    const { airlineToken, orderId, supplierToken } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440013' })
      .expect(201);
    const paymentId = createRes.body.data.payment.id as string;

    await request
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Cookie', cookie(supplierToken))
      .send({})
      .expect(403);
  });
});

// ── GET /payments/:id ─────────────────────────────────────────────────────────

describe('GET /api/v1/payments/:id — get payment', () => {
  it('returns payment for the payer', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440020' })
      .expect(201);
    const paymentId = createRes.body.data.payment.id as string;

    const getRes = await request
      .get(`/api/v1/payments/${paymentId}`)
      .set('Cookie', cookie(airlineToken));

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.payment.id).toBe(paymentId);
  });

  it('returns payment for the payee (supplier)', async () => {
    const { airlineToken, supplierToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440021' })
      .expect(201);
    const paymentId = createRes.body.data.payment.id as string;

    const getRes = await request
      .get(`/api/v1/payments/${paymentId}`)
      .set('Cookie', cookie(supplierToken));

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.payment.id).toBe(paymentId);
  });

  it('returns 404 for an unrelated third party', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440022' })
      .expect(201);
    const paymentId = createRes.body.data.payment.id as string;

    const other      = await createUser({ email: 'noone@other.com', role: UserRole.AIRLINE });
    const otherToken = tokenFor({ _id: other._id, email: other.email, role: other.role });

    await request
      .get(`/api/v1/payments/${paymentId}`)
      .set('Cookie', cookie(otherToken))
      .expect(404);
  });
});

// ── POST /payments/webhook — handleWebhook ─────────────────────────────────────

describe('POST /api/v1/payments/webhook — handleWebhook', () => {
  it('successful payment.succeeded webhook marks payment CAPTURED and order PAID', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440030' })
      .expect(201);

    const providerPaymentId = createRes.body.data.payment.providerPaymentId as string;

    const { body, signature } = buildWebhook(
      'payment.succeeded',
      providerPaymentId,
      `txn_${providerPaymentId}`,
    );

    const webhookRes = await request
      .post('/api/v1/payments/webhook')
      .set('x-payment-signature', signature)
      .set('Content-Type', 'application/octet-stream')
      .send(body);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.received).toBe(true);

    // Verify payment is CAPTURED
    const payment = await PaymentModel.findOne({ providerPaymentId });
    expect(payment?.status).toBe(PaymentStatus.CAPTURED);
    expect(payment?.paidAt).toBeTruthy();

    // Verify order is PAID
    const order = await OrderModel.findById(orderId);
    expect(order?.status).toBe(OrderStatus.PAID);
    expect(order?.paidAt).toBeTruthy();
  });

  it('failed payment.failed webhook marks payment FAILED and does NOT advance order', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440031' })
      .expect(201);

    const providerPaymentId = createRes.body.data.payment.providerPaymentId as string;

    const { body, signature } = buildWebhook(
      'payment.failed',
      providerPaymentId,
      `txn_failed_${providerPaymentId}`,
      { failureReason: 'Insufficient funds' },
    );

    await request
      .post('/api/v1/payments/webhook')
      .set('x-payment-signature', signature)
      .set('Content-Type', 'application/octet-stream')
      .send(body)
      .expect(200);

    const payment = await PaymentModel.findOne({ providerPaymentId });
    expect(payment?.status).toBe(PaymentStatus.FAILED);
    expect(payment?.failureReason).toBe('Insufficient funds');

    // Order must remain PAYMENT_PENDING — NOT advanced
    const order = await OrderModel.findById(orderId);
    expect(order?.status).toBe(OrderStatus.PAYMENT_PENDING);
  });

  it('duplicate payment.succeeded webhook is idempotent — no second state change', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440032' })
      .expect(201);

    const providerPaymentId = createRes.body.data.payment.providerPaymentId as string;

    const { body, signature } = buildWebhook(
      'payment.succeeded',
      providerPaymentId,
      `txn_${providerPaymentId}`,
    );

    // First delivery
    await request
      .post('/api/v1/payments/webhook')
      .set('x-payment-signature', signature)
      .set('Content-Type', 'application/octet-stream')
      .send(body)
      .expect(200);

    // Second delivery (same signature, same body)
    const secondRes = await request
      .post('/api/v1/payments/webhook')
      .set('x-payment-signature', signature)
      .set('Content-Type', 'application/octet-stream')
      .send(body);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.received).toBe(true);

    // Payment still CAPTURED — not double-applied
    const payment = await PaymentModel.findOne({ providerPaymentId });
    expect(payment?.status).toBe(PaymentStatus.CAPTURED);

    // Order still PAID — not regressed
    const order = await OrderModel.findById(orderId);
    expect(order?.status).toBe(OrderStatus.PAID);
  });

  it('rejects a webhook with invalid signature (HTTP 400)', async () => {
    const { body } = buildWebhook('payment.succeeded', 'pi_fake', 'txn_fake');

    const res = await request
      .post('/api/v1/payments/webhook')
      .set('x-payment-signature', 't=99999,v1=invalidsignature0000000000000000000000000000000000000000000000000000')
      .set('Content-Type', 'application/octet-stream')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('returns 400 when x-payment-signature header is missing', async () => {
    const res = await request
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('MISSING_SIGNATURE');
  });

  it('acknowledges webhook for unknown providerPaymentId without error', async () => {
    const { body, signature } = buildWebhook('payment.succeeded', 'pi_unknown_xyz', 'txn_xyz');

    const res = await request
      .post('/api/v1/payments/webhook')
      .set('x-payment-signature', signature)
      .set('Content-Type', 'application/octet-stream')
      .send(body);

    // Must 200 so provider stops retrying
    expect(res.status).toBe(200);
  });
});

// ── POST /payments/:id/refund ─────────────────────────────────────────────────

describe('POST /api/v1/payments/:id/refund — refund', () => {
  let _refundIkSuffix = 60;
  async function buildCapturedPayment() {
    const suffix = String(_refundIkSuffix++).padStart(2, '0');
    const ik = `550e8400-e29b-41d4-a716-4466554400${suffix}`;
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: ik })
      .expect(201);

    const providerPaymentId = createRes.body.data.payment.providerPaymentId as string;
    const paymentId         = createRes.body.data.payment.id as string;

    // Confirm first
    MockPaymentProvider.nextOutcome = 'success';
    await request
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Cookie', cookie(airlineToken))
      .send({})
      .expect(200);

    // Webhook: advance to CAPTURED
    const { body, signature } = buildWebhook('payment.succeeded', providerPaymentId, `txn_${providerPaymentId}`);
    await request
      .post('/api/v1/payments/webhook')
      .set('x-payment-signature', signature)
      .set('Content-Type', 'application/octet-stream')
      .send(body)
      .expect(200);

    return { airlineToken, paymentId, orderId };
  }

  it('refunds a CAPTURED payment', async () => {
    const { airlineToken, paymentId } = await buildCapturedPayment();

    const res = await request
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set('Cookie', cookie(airlineToken))
      .send({ reason: 'Order cancelled by buyer' });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(res.body.data.payment.refundedAt).toBeTruthy();
  });

  it('double refund is idempotent — returns current REFUNDED state', async () => {
    const { airlineToken, paymentId } = await buildCapturedPayment();

    await request
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set('Cookie', cookie(airlineToken))
      .send({})
      .expect(200);

    const second = await request
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set('Cookie', cookie(airlineToken))
      .send({});

    expect(second.status).toBe(200);
    expect(second.body.data.payment.status).toBe(PaymentStatus.REFUNDED);
  });

  it('rejects a refund by the supplier (non-payer)', async () => {
    // Build the payment using a single fixture so airline + supplier come from the same order
    const { airlineToken, supplierToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440090' })
      .expect(201);
    const paymentId = createRes.body.data.payment.id as string;

    await request
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set('Cookie', cookie(supplierToken))
      .send({})
      .expect(403);
  });

  it('rejects a refund for a non-CAPTURED payment', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const createRes = await request
      .post('/api/v1/payments')
      .set('Cookie', cookie(airlineToken))
      .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: '550e8400-e29b-41d4-a716-446655440042' })
      .expect(201);
    const paymentId = createRes.body.data.payment.id as string;

    // Payment is still PENDING — not CAPTURED
    const res = await request
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set('Cookie', cookie(airlineToken))
      .send({});

    expect(res.status).toBe(409);
  });
});

// ── Frontend cannot set PAID via PATCH /orders/:id/status ─────────────────────

describe('Frontend cannot directly set order to PAID', () => {
  it('PATCH /orders/:id/status returns 409 when attempting PAYMENT_PENDING → PAID', async () => {
    const { airlineToken, orderId } = await createPaymentPendingOrder();

    const res = await request
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Cookie', cookie(airlineToken))
      .send({ status: OrderStatus.PAID });

    // The state machine no longer has this edge — must be 409
    expect(res.status).toBe(409);
  });
});
