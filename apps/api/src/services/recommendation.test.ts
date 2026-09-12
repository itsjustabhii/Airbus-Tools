import { ProductCategory, ProductCondition, ProductStatus, InteractionType } from '@airbus-tools/shared';
import mongoose from 'mongoose';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { InteractionModel } from '../database/models/Interaction';
import { ProductModel } from '../database/models/Product';
import { setupTestDB, teardownTestDB, clearTestDB } from '../database/test-utils';
import { interactionService } from './interactionService';
import {
  recommendationService,
  computeScore,
  popularitySignal,
  recencySignal,
  stockSignal,
  deliverySignal,
  RANKING_SIGNALS,
  type RankingContext,
} from './recommendationService';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_PRODUCT = {
  title: 'Test Part',
  partNumber: 'TEST-001',
  description: 'A test aerospace component',
  category: ProductCategory.FASTENERS,
  condition: ProductCondition.NEW,
  status: ProductStatus.ACTIVE,
  price: 100,
  currency: 'USD',
  quantityAvailable: 50,
  minimumOrderQuantity: 1,
  certifications: [],
  tags: [],
  mediaUrls: [],
};

function makeProduct(overrides: Partial<typeof BASE_PRODUCT & { sellerId?: mongoose.Types.ObjectId }> = {}) {
  const sellerId = overrides.sellerId ?? new mongoose.Types.ObjectId();
  return { ...BASE_PRODUCT, sellerId, ...overrides };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('InteractionService', () => {
  beforeAll(() => setupTestDB());
  afterAll(() => teardownTestDB());
  beforeEach(() => clearTestDB());

  it('records a viewed interaction', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const interaction = await interactionService.recordViewed('prod-1', { userId });
    expect(interaction.type).toBe(InteractionType.VIEW);
    expect(interaction.entityType).toBe('PRODUCT');
    expect(interaction.entityId).toBe('prod-1');
  });

  it('records a contacted interaction', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const interaction = await interactionService.recordContacted('prod-2', { userId });
    expect(interaction.type).toBe(InteractionType.INQUIRY);
    expect(interaction.entityType).toBe('PRODUCT');
  });

  it('records a requested (RFQ) interaction', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const interaction = await interactionService.recordRequested('prod-3', { userId });
    expect(interaction.type).toBe(InteractionType.RFQ);
    expect(interaction.entityType).toBe('PRODUCT');
  });

  it('records an ordered interaction (entityType ORDER)', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const interaction = await interactionService.recordOrdered('order-1', { userId });
    expect(interaction.entityType).toBe('ORDER');
    expect(interaction.entityId).toBe('order-1');
  });

  it('getInteractedProductIds returns deduplicated product IDs', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const otherUserId = new mongoose.Types.ObjectId().toString();
    await interactionService.recordViewed('prod-A', { userId });
    await interactionService.recordViewed('prod-A', { userId }); // duplicate
    await interactionService.recordContacted('prod-B', { userId });
    await interactionService.recordViewed('prod-C', { userId: otherUserId }); // different user

    const ids = await interactionService.getInteractedProductIds(userId);
    expect(ids).toHaveLength(2);
    expect(ids).toContain('prod-A');
    expect(ids).toContain('prod-B');
    expect(ids).not.toContain('prod-C');
  });
});

describe('Ranking signals (unit)', () => {
  const makeCtx = (viewCounts: Record<string, number> = {}, nowMs = Date.now()): RankingContext => ({
    viewCounts: new Map(Object.entries(viewCounts)),
    nowMs,
  });

  it('popularitySignal returns 0 for unseen product', () => {
    const doc = new ProductModel({ ...makeProduct(), _id: new mongoose.Types.ObjectId() });
    expect(popularitySignal(doc as never, makeCtx())).toBe(0);
  });

  it('popularitySignal caps at 50 for high-view products', () => {
    const id = new mongoose.Types.ObjectId();
    const doc = new ProductModel({ ...makeProduct(), _id: id });
    expect(popularitySignal(doc as never, makeCtx({ [id.toString()]: 200 }))).toBe(50);
  });

  it('recencySignal returns 30 for brand-new product', () => {
    const doc = new ProductModel({ ...makeProduct(), createdAt: new Date() });
    const score = recencySignal(doc as never, makeCtx());
    expect(score).toBeCloseTo(30, 0);
  });

  it('recencySignal returns 0 for 8-day-old product', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const doc = new ProductModel({ ...makeProduct(), createdAt: eightDaysAgo });
    expect(recencySignal(doc as never, makeCtx())).toBe(0);
  });

  it('stockSignal caps at 20 for high-stock product', () => {
    const doc = new ProductModel({ ...makeProduct(), quantityAvailable: 1000 });
    expect(stockSignal(doc as never, makeCtx())).toBe(20);
  });

  it('deliverySignal returns 15 for ≤7-day delivery', () => {
    const doc = new ProductModel({ ...makeProduct(), estimatedDeliveryDays: 5 });
    expect(deliverySignal(doc as never, makeCtx())).toBe(15);
  });

  it('deliverySignal returns 8 for 8–14-day delivery', () => {
    const doc = new ProductModel({ ...makeProduct(), estimatedDeliveryDays: 10 });
    expect(deliverySignal(doc as never, makeCtx())).toBe(8);
  });

  it('deliverySignal returns 0 for no delivery estimate', () => {
    const doc = new ProductModel({ ...makeProduct(), estimatedDeliveryDays: undefined });
    expect(deliverySignal(doc as never, makeCtx())).toBe(0);
  });

  it('computeScore sums all signals', () => {
    const id = new mongoose.Types.ObjectId();
    const doc = new ProductModel({
      ...makeProduct({ quantityAvailable: 100, estimatedDeliveryDays: 5 }),
      _id: id,
      createdAt: new Date(),
    });
    const ctx = makeCtx({ [id.toString()]: 30 });
    const score = computeScore(doc as never, ctx, RANKING_SIGNALS);
    // popularitySignal: 30, recencySignal: ~30, stockSignal: 20, deliverySignal: 15 → ≥ 95
    expect(score).toBeGreaterThan(90);
  });
});

describe('RecommendationService — $nin exclusion & cursor pagination', () => {
  beforeAll(() => setupTestDB());
  afterAll(() => teardownTestDB());
  beforeEach(() => clearTestDB());

  async function seedProducts(count: number, overrides: Partial<typeof BASE_PRODUCT> = {}) {
    const sellerId = new mongoose.Types.ObjectId();
    return Promise.all(
      Array.from({ length: count }, (_, i) =>
        ProductModel.create({
          ...BASE_PRODUCT,
          ...overrides,
          sellerId,
          title: `Product ${i}`,
          partNumber: `PN-${i.toString().padStart(4, '0')}`,
        }),
      ),
    );
  }

  it('excludes products the user has already interacted with ($nin)', async () => {
    const products = await seedProducts(5);
    const userId = new mongoose.Types.ObjectId().toString();

    // Interact with first 2 products
    await InteractionModel.create({
      userId,
      type: InteractionType.VIEW,
      entityType: 'PRODUCT',
      entityId: products[0]!._id.toString(),
    });
    await InteractionModel.create({
      userId,
      type: InteractionType.RFQ,
      entityType: 'PRODUCT',
      entityId: products[1]!._id.toString(),
    });

    const result = await recommendationService.getRecommendations({ userId });

    const returnedIds = result.items.map((p) => p._id.toString());
    expect(returnedIds).not.toContain(products[0]!._id.toString());
    expect(returnedIds).not.toContain(products[1]!._id.toString());
    expect(returnedIds).toHaveLength(3);
  });

  it('returns all active products when user has no interactions', async () => {
    await seedProducts(6);
    const userId = new mongoose.Types.ObjectId().toString();
    const result = await recommendationService.getRecommendations({ userId });
    expect(result.items).toHaveLength(6);
  });

  it('does NOT return out-of-stock or non-ACTIVE products', async () => {
    const sellerId = new mongoose.Types.ObjectId();
    await ProductModel.create({
      ...BASE_PRODUCT,
      sellerId,
      partNumber: 'OOS-001',
      quantityAvailable: 0, // out of stock
    });
    await ProductModel.create({
      ...BASE_PRODUCT,
      sellerId,
      partNumber: 'DFT-001',
      status: ProductStatus.DRAFT, // not active
      quantityAvailable: 10,
    });
    await ProductModel.create({
      ...BASE_PRODUCT,
      sellerId,
      partNumber: 'ACT-001',
      quantityAvailable: 10,
    });

    const result = await recommendationService.getRecommendations({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.partNumber).toBe('ACT-001');
  });

  it('cursor pagination: first page returns nextCursor, second page returns remaining items', async () => {
    await seedProducts(5);

    const page1 = await recommendationService.getRecommendations({ limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.hasNextPage).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await recommendationService.getRecommendations({
      cursor: page1.nextCursor!,
      limit: 3,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.hasNextPage).toBe(false);
    expect(page2.nextCursor).toBeNull();

    // No duplicates between pages
    const p1Ids = new Set(page1.items.map((p) => p._id.toString()));
    const p2Ids = page2.items.map((p) => p._id.toString());
    for (const id of p2Ids) {
      expect(p1Ids.has(id)).toBe(false);
    }
  });

  it('cursor pagination: returns empty page when cursor points past last item', async () => {
    await seedProducts(2);

    const page1 = await recommendationService.getRecommendations({ limit: 2 });
    expect(page1.hasNextPage).toBe(false);
    expect(page1.nextCursor).toBeNull();

    // Navigating "next" with no cursor after end returns empty items
    const page2 = await recommendationService.getRecommendations({ cursor: undefined, limit: 2 });
    // Same 2 items — no duplication issue, just same snapshot
    expect(page2.items).toHaveLength(2);
  });

  it('ranking: product with more views ranked higher than product with no views', async () => {
    const products = await seedProducts(2);
    const popularId = products[0]!._id.toString();

    // Give product[0] 10 views (use valid ObjectIds for userId)
    await Promise.all(
      Array.from({ length: 10 }, () =>
        InteractionModel.create({
          userId: new mongoose.Types.ObjectId(),
          type: InteractionType.VIEW,
          entityType: 'PRODUCT',
          entityId: popularId,
        }),
      ),
    );

    // Both created at same time so recency is equal; popularity decides rank
    const result = await recommendationService.getRecommendations({});
    expect(result.items[0]!._id.toString()).toBe(popularId);
  });

  it('uses a malformed cursor gracefully (starts from beginning)', async () => {
    await seedProducts(3);
    const result = await recommendationService.getRecommendations({ cursor: 'NOT_VALID_BASE64!!' });
    expect(result.items).toHaveLength(3);
  });
});
