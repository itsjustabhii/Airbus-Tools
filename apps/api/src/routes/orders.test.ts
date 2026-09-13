/**
 * Integration tests for Phase 6: Order / Request Workflow
 *
 * Covers:
 *  - Valid state transitions:  PENDING → ACCEPTED → PAYMENT_PENDING → PAID → COMPLETED
 *  - Valid terminal:           PENDING → REJECTED  (with rejectionReason)
 *  - All invalid transitions   (every non-existent edge in the state machine)
 *  - Role-based access control (wrong role attempting a valid edge)
 *  - Ownership / participant enforcement (third party cannot read or modify)
 *  - Modification of terminal orders (REJECTED, COMPLETED)
 *  - Field ownership guards    (airline cannot set rejectionReason)
 *  - Price snapshot             (product price change does NOT alter existing order)
 *  - POST /orders validation    (missing fields, cross-supplier items)
 *  - GET  /orders scoping       (airline only sees their orders; supplier only sees their sales)
 */

import bcrypt from 'bcrypt';
import supertest from 'supertest';
import {
  describe, it, expect,
  beforeAll, afterAll, beforeEach,
} from 'vitest';

import { OrderStatus, PaymentMethod, UserRole, UserStatus, ProductStatus, ProductCategory, ProductCondition } from '@airbus-tools/shared';

import { createApp } from '../app';
import { signToken } from '../auth/jwt';
import { AUTH_COOKIE_NAME } from '../auth/service';
import { UserModel } from '../database/models/User';
import { ProductModel } from '../database/models/Product';
import { OrderModel } from '../database/models/Order';
import { setupTestDB, teardownTestDB, clearTestDB } from '../database/test-utils';
import { MockPaymentProvider } from '../services/payment/MockPaymentProvider';

const app = createApp();
const request = supertest(app);

// ── DB lifecycle ─────────────────────────────────────────────────────────────

beforeAll(async () => { await setupTestDB(); });
afterAll(async ()  => { await teardownTestDB(); });
beforeEach(async () => { await clearTestDB(); });

// ── Fixtures ─────────────────────────────────────────────────────────────────

async function createUser(overrides: Record<string, unknown> = {}) {
  const hash = await bcrypt.hash('Password1', 10);
  return UserModel.create({
    email:        'user@test.com',
    firstName:    'Test',
    lastName:     'User',
    passwordHash: hash,
    role:         UserRole.AIRLINE,
    status:       UserStatus.ACTIVE,
    ...overrides,
  });
}

async function createProduct(sellerId: string, overrides: Record<string, unknown> = {}) {
  return ProductModel.create({
    sellerId,
    title:              'Hydraulic Bolt',
    partNumber:         'HB-001',
    description:        'A standard hydraulic bolt.',
    category:           ProductCategory.FASTENERS,
    condition:          ProductCondition.NEW,
    status:             ProductStatus.ACTIVE,
    price:              150,
    currency:           'USD',
    quantityAvailable:  100,
    minimumOrderQuantity: 1,
    certifications:     [],
    tags:               [],
    mediaUrls:          [],
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
  street:     '1 Runway Lane',
  city:       'Toulouse',
  postalCode: '31000',
  country:    'FR',
};

// ── Helper: build a full order in a given status ──────────────────────────────

interface OrderFixture {
  airline:         Awaited<ReturnType<typeof createUser>>;
  supplier:        Awaited<ReturnType<typeof createUser>>;
  product:         Awaited<ReturnType<typeof createProduct>>;
  airlineToken:    string;
  supplierToken:   string;
  orderId:         string;
}

async function createPendingOrder(): Promise<OrderFixture> {
  const airline  = await createUser({ email: 'airline@test.com',  role: UserRole.AIRLINE });
  const supplier = await createUser({ email: 'supplier@test.com', role: UserRole.SUPPLIER });
  const product  = await createProduct(String(supplier._id));

  const airlineToken  = tokenFor(airline);
  const supplierToken = tokenFor(supplier);

  const res = await request
    .post('/api/v1/orders')
    .set('Cookie', cookie(airlineToken))
    .send({
      items: [{ productId: String(product._id), quantity: 2 }],
      shippingAddress: validAddress,
    });

  expect(res.status).toBe(201);

  return {
    airline,
    supplier,
    product,
    airlineToken,
    supplierToken,
    orderId: res.body.data.order.id as string,
  };
}

/** Advance an order through a transition using a given token */
async function transition(
  orderId: string,
  token: string,
  status: OrderStatus,
  extra: Record<string, unknown> = {},
) {
  return request
    .patch(`/api/v1/orders/${orderId}/status`)
    .set('Cookie', cookie(token))
    .send({ status, ...extra });
}

/**
 * Helper: advance an order to PAID via the webhook mechanism (Phase 10).
 *
 * PAYMENT_PENDING → PAID is no longer possible through the public HTTP state
 * machine — the webhook is the authoritative path.  Tests that need a PAID
 * order must use this helper instead of calling transition() with PAID.
 */
let _orderIkSuffix = 1;
async function advanceOrderToPaid(orderId: string, airlineToken: string): Promise<void> {
  const ik = `aa000000-0000-0000-0000-${String(_orderIkSuffix++).padStart(12, '0')}`;

  const createRes = await request
    .post('/api/v1/payments')
    .set('Cookie', cookie(airlineToken))
    .send({ orderId, paymentMethod: PaymentMethod.CREDIT_CARD, idempotencyKey: ik });

  const providerPaymentId = createRes.body.data?.payment?.providerPaymentId as string;
  if (!providerPaymentId) return;

  const payload = Buffer.from(
    JSON.stringify({ type: 'payment.succeeded', providerPaymentId, transactionReference: `txn_${providerPaymentId}` }),
    'utf8',
  );
  const signature = MockPaymentProvider.sign(payload);

  await request
    .post('/api/v1/payments/webhook')
    .set('x-payment-signature', signature)
    .set('Content-Type', 'application/octet-stream')
    .send(payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/orders
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/orders — create order', () => {
  it('creates an order in PENDING status and snapshots the product price', async () => {
    const { airlineToken, product, orderId } = await createPendingOrder();
    void airlineToken;

    const order = await OrderModel.findById(orderId);
    expect(order).not.toBeNull();
    expect(order!.status).toBe(OrderStatus.PENDING);
    expect(order!.items[0]!.unitPrice).toBe(150);
    expect(order!.items[0]!.currency).toBe('USD');
    expect(order!.items[0]!.quantity).toBe(2);
    expect(order!.subtotal).toBe(300);
    expect(order!.placedAt).toBeDefined();
    void product;
  });

  it('price snapshot is immutable — changing product price does not affect existing order', async () => {
    const { product, orderId } = await createPendingOrder();

    // Supplier changes price after order is placed
    await ProductModel.findByIdAndUpdate(product._id, { price: 9999 });

    const order = await OrderModel.findById(orderId);
    expect(order!.items[0]!.unitPrice).toBe(150);   // original price
    expect(order!.totalAmount).toBe(300);             // original total
  });

  it('returns 201 and sets sellerId from product', async () => {
    const { supplier, orderId } = await createPendingOrder();

    const order = await OrderModel.findById(orderId);
    expect(order!.sellerId.toString()).toBe(String(supplier._id));
  });

  it('returns 401 when unauthenticated', async () => {
    const supplier = await createUser({ email: 'sup@test.com', role: UserRole.SUPPLIER });
    const product  = await createProduct(String(supplier._id));

    const res = await request
      .post('/api/v1/orders')
      .send({ items: [{ productId: String(product._id), quantity: 1 }], shippingAddress: validAddress });

    expect(res.status).toBe(401);
  });

  it('returns 403 when a SUPPLIER tries to place an order', async () => {
    const supplier = await createUser({ email: 'sup@test.com', role: UserRole.SUPPLIER });
    const product  = await createProduct(String(supplier._id));

    const res = await request
      .post('/api/v1/orders')
      .set('Cookie', cookie(tokenFor(supplier)))
      .send({ items: [{ productId: String(product._id), quantity: 1 }], shippingAddress: validAddress });

    expect(res.status).toBe(403);
  });

  it('returns 422 when items array is empty', async () => {
    const airline  = await createUser({ email: 'a@test.com',  role: UserRole.AIRLINE });

    const res = await request
      .post('/api/v1/orders')
      .set('Cookie', cookie(tokenFor(airline)))
      .send({ items: [], shippingAddress: validAddress });

    expect(res.status).toBe(422);
  });

  it('returns 422 when shippingAddress is missing', async () => {
    const airline  = await createUser({ email: 'a@test.com', role: UserRole.AIRLINE });
    const supplier = await createUser({ email: 's@test.com', role: UserRole.SUPPLIER });
    const product  = await createProduct(String(supplier._id));

    const res = await request
      .post('/api/v1/orders')
      .set('Cookie', cookie(tokenFor(airline)))
      .send({ items: [{ productId: String(product._id), quantity: 1 }] });

    expect(res.status).toBe(422);
  });

  it('returns 404 when a product does not exist', async () => {
    const airline = await createUser({ email: 'a@test.com', role: UserRole.AIRLINE });

    const res = await request
      .post('/api/v1/orders')
      .set('Cookie', cookie(tokenFor(airline)))
      .send({
        items: [{ productId: '000000000000000000000000', quantity: 1 }],
        shippingAddress: validAddress,
      });

    expect(res.status).toBe(404);
  });

  it('rejects orders with items from multiple suppliers', async () => {
    const airline   = await createUser({ email: 'a@test.com',  role: UserRole.AIRLINE });
    const supplier1 = await createUser({ email: 's1@test.com', role: UserRole.SUPPLIER });
    const supplier2 = await createUser({ email: 's2@test.com', role: UserRole.SUPPLIER });
    const product1  = await createProduct(String(supplier1._id));
    const product2  = await createProduct(String(supplier2._id), { partNumber: 'HB-002' });

    const res = await request
      .post('/api/v1/orders')
      .set('Cookie', cookie(tokenFor(airline)))
      .send({
        items: [
          { productId: String(product1._id), quantity: 1 },
          { productId: String(product2._id), quantity: 1 },
        ],
        shippingAddress: validAddress,
      });

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/orders
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/orders — list orders', () => {
  it('airline only sees their own orders', async () => {
    const { airlineToken, orderId } = await createPendingOrder();

    const res = await request
      .get('/api/v1/orders')
      .set('Cookie', cookie(airlineToken));

    expect(res.status).toBe(200);
    const ids = res.body.data.orders.map((o: { id: string }) => o.id);
    expect(ids).toContain(orderId);
  });

  it('supplier only sees sales assigned to them', async () => {
    const { supplierToken, orderId } = await createPendingOrder();

    const res = await request
      .get('/api/v1/orders')
      .set('Cookie', cookie(supplierToken));

    expect(res.status).toBe(200);
    const ids = res.body.data.orders.map((o: { id: string }) => o.id);
    expect(ids).toContain(orderId);
  });

  it('airline cannot see another airline\'s orders', async () => {
    await createPendingOrder();

    const other = await createUser({ email: 'other@test.com', role: UserRole.AIRLINE });
    const res   = await request
      .get('/api/v1/orders')
      .set('Cookie', cookie(tokenFor(other)));

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(0);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request.get('/api/v1/orders');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/orders/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/orders/:id — get single order', () => {
  it('airline can read their own order and sees availableTransitions', async () => {
    const { airlineToken, orderId } = await createPendingOrder();

    const res = await request
      .get(`/api/v1/orders/${orderId}`)
      .set('Cookie', cookie(airlineToken));

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe(OrderStatus.PENDING);
    // AIRLINE cannot transition PENDING directly
    expect(res.body.data.availableTransitions).toEqual([]);
  });

  it('supplier can read an order and sees ACCEPTED and REJECTED as available transitions', async () => {
    const { supplierToken, orderId } = await createPendingOrder();

    const res = await request
      .get(`/api/v1/orders/${orderId}`)
      .set('Cookie', cookie(supplierToken));

    expect(res.status).toBe(200);
    expect(res.body.data.availableTransitions).toEqual(
      expect.arrayContaining([OrderStatus.ACCEPTED, OrderStatus.REJECTED]),
    );
  });

  it('returns 404 for a third party (not buyer, not seller)', async () => {
    const { orderId } = await createPendingOrder();

    const thirdParty = await createUser({ email: 'third@test.com', role: UserRole.AIRLINE });

    const res = await request
      .get(`/api/v1/orders/${orderId}`)
      .set('Cookie', cookie(tokenFor(thirdParty)));

    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const { orderId } = await createPendingOrder();
    const res = await request.get(`/api/v1/orders/${orderId}`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Valid state transition path: full lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('Order state machine — valid full lifecycle', () => {
  it('PENDING → ACCEPTED (supplier)', async () => {
    const { supplierToken, orderId } = await createPendingOrder();

    const res = await transition(orderId, supplierToken, OrderStatus.ACCEPTED);

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe(OrderStatus.ACCEPTED);
    expect(res.body.data.order.acceptedAt).not.toBeNull();
  });

  it('ACCEPTED → PAYMENT_PENDING (airline)', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();

    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    const res = await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe(OrderStatus.PAYMENT_PENDING);
  });

  it('PAYMENT_PENDING → PAID (via webhook — authoritative path)', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();

    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);

    // PAID is set exclusively by the payment webhook — not by PATCH /orders/:id/status
    await advanceOrderToPaid(orderId, airlineToken);

    const order = await OrderModel.findById(orderId);
    expect(order?.status).toBe(OrderStatus.PAID);
    expect(order?.paidAt).not.toBeNull();
  });

  it('PAID → COMPLETED (supplier)', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();

    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);
    await advanceOrderToPaid(orderId, airlineToken);
    const res = await transition(orderId, supplierToken, OrderStatus.COMPLETED);

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe(OrderStatus.COMPLETED);
    expect(res.body.data.order.completedAt).not.toBeNull();
  });

  it('PENDING → REJECTED with reason (supplier)', async () => {
    const { supplierToken, orderId } = await createPendingOrder();

    const res = await transition(orderId, supplierToken, OrderStatus.REJECTED, {
      rejectionReason: 'Out of stock',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe(OrderStatus.REJECTED);
    expect(res.body.data.order.rejectionReason).toBe('Out of stock');
    expect(res.body.data.order.rejectedAt).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Invalid state transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('Order state machine — invalid transitions return 409', () => {
  it('PENDING → PAYMENT_PENDING is not allowed', async () => {
    const { airlineToken, orderId } = await createPendingOrder();
    const res = await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('PENDING → PAID is not allowed', async () => {
    const { airlineToken, orderId } = await createPendingOrder();
    const res = await transition(orderId, airlineToken, OrderStatus.PAID);
    expect(res.status).toBe(409);
  });

  it('PENDING → COMPLETED is not allowed', async () => {
    const { supplierToken, orderId } = await createPendingOrder();
    const res = await transition(orderId, supplierToken, OrderStatus.COMPLETED);
    expect(res.status).toBe(409);
  });

  it('ACCEPTED → REJECTED is not allowed', async () => {
    const { supplierToken, orderId } = await createPendingOrder();
    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    const res = await transition(orderId, supplierToken, OrderStatus.REJECTED);
    expect(res.status).toBe(409);
  });

  it('ACCEPTED → PAID is not allowed', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();
    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    const res = await transition(orderId, airlineToken, OrderStatus.PAID);
    expect(res.status).toBe(409);
  });

  it('ACCEPTED → PENDING is not allowed (no backward transitions)', async () => {
    const { supplierToken, orderId } = await createPendingOrder();
    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    const res = await transition(orderId, supplierToken, OrderStatus.PENDING);
    expect(res.status).toBe(409);
  });

  it('PAYMENT_PENDING → ACCEPTED is not allowed', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();
    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);
    const res = await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    expect(res.status).toBe(409);
  });

  it('PAID → REJECTED is not allowed', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();
    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);
    await advanceOrderToPaid(orderId, airlineToken);
    const res = await transition(orderId, supplierToken, OrderStatus.REJECTED);
    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Role-permission guard (valid edge, wrong role)
// ─────────────────────────────────────────────────────────────────────────────

describe('Order state machine — role permission on valid edges', () => {
  it('AIRLINE cannot accept an order (supplier-only transition)', async () => {
    const { airlineToken, orderId } = await createPendingOrder();
    const res = await transition(orderId, airlineToken, OrderStatus.ACCEPTED);
    expect(res.status).toBe(403);
  });

  it('AIRLINE cannot reject an order (field-ownership guard fires first with 422)', async () => {
    const { airlineToken, orderId } = await createPendingOrder();
    // The route rejects the supplier-owned field before even reaching the state machine,
    // so the response is 422 (field ownership violation), not 403.
    const res = await transition(orderId, airlineToken, OrderStatus.REJECTED, {
      rejectionReason: 'try',
    });
    expect(res.status).toBe(422);
  });

  it('AIRLINE cannot reject an order even without a rejectionReason (role guard)', async () => {
    const { airlineToken, orderId } = await createPendingOrder();
    // Without rejectionReason the route lets the state machine handle it → 403 (wrong role)
    const res = await transition(orderId, airlineToken, OrderStatus.REJECTED);
    expect(res.status).toBe(403);
  });

  it('SUPPLIER cannot trigger PAYMENT_PENDING', async () => {
    const { supplierToken, orderId } = await createPendingOrder();
    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    const res = await transition(orderId, supplierToken, OrderStatus.PAYMENT_PENDING);
    expect(res.status).toBe(403);
  });

  it('SUPPLIER cannot confirm payment (PAID) — PAYMENT_PENDING→PAID is not an HTTP edge', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();
    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);
    // No role can set PAID via PATCH /orders/:id/status — the edge was removed
    const resBySupplier = await transition(orderId, supplierToken, OrderStatus.PAID);
    expect(resBySupplier.status).toBe(409); // INVALID_TRANSITION (not in state machine)
    const resByAirline = await transition(orderId, airlineToken, OrderStatus.PAID);
    expect(resByAirline.status).toBe(409); // same
  });

  it('AIRLINE cannot mark an order COMPLETED', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();
    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);
    await advanceOrderToPaid(orderId, airlineToken);
    const res = await transition(orderId, airlineToken, OrderStatus.COMPLETED);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Terminal order guards
// ─────────────────────────────────────────────────────────────────────────────

describe('Terminal order modification prevention', () => {
  it('COMPLETED order cannot be modified', async () => {
    const { airlineToken, supplierToken, orderId } = await createPendingOrder();

    await transition(orderId, supplierToken, OrderStatus.ACCEPTED);
    await transition(orderId, airlineToken, OrderStatus.PAYMENT_PENDING);
    await advanceOrderToPaid(orderId, airlineToken);
    await transition(orderId, supplierToken, OrderStatus.COMPLETED);

    // Completed order is terminal — any further transition is blocked
    const res = await transition(orderId, supplierToken, OrderStatus.PAID);
    expect(res.status).toBe(403);
  });

  it('REJECTED order cannot be modified', async () => {
    const { supplierToken, orderId } = await createPendingOrder();

    await transition(orderId, supplierToken, OrderStatus.REJECTED, {
      rejectionReason: 'No stock',
    });

    const res = await transition(orderId, supplierToken, OrderStatus.PENDING);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Field ownership guards
// ─────────────────────────────────────────────────────────────────────────────

describe('Field ownership guards', () => {
  it('AIRLINE cannot set rejectionReason', async () => {
    const { airlineToken, orderId } = await createPendingOrder();

    const res = await request
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Cookie', cookie(airlineToken))
      .send({ status: OrderStatus.ACCEPTED, rejectionReason: 'hacked' });

    expect(res.status).toBe(422);
  });

  it('REJECTED transition without rejectionReason is rejected', async () => {
    const { supplierToken, orderId } = await createPendingOrder();

    const res = await transition(orderId, supplierToken, OrderStatus.REJECTED);
    // Missing rejectionReason — service throws 403
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Participant isolation (third-party access)
// ─────────────────────────────────────────────────────────────────────────────

describe('Participant isolation', () => {
  it('third party cannot transition an order they are not party to', async () => {
    const { orderId } = await createPendingOrder();

    const intruder = await createUser({ email: 'intruder@test.com', role: UserRole.SUPPLIER });

    const res = await transition(orderId, tokenFor(intruder), OrderStatus.ACCEPTED);
    expect(res.status).toBe(404);
  });

  it('third-party airline cannot read another airline\'s order', async () => {
    const { orderId } = await createPendingOrder();

    const other = await createUser({ email: 'other@test.com', role: UserRole.AIRLINE });
    const res   = await request
      .get(`/api/v1/orders/${orderId}`)
      .set('Cookie', cookie(tokenFor(other)));

    expect(res.status).toBe(404);
  });
});
