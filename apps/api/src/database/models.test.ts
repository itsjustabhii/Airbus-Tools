import {
  UserRole,
  UserStatus,
  ProductCategory,
  ProductCondition,
  ProductStatus,
  OrderStatus,
  ConversationType,
  MessageType,
  PaymentMethod,
  PaymentStatus,
  InteractionType,
  NotificationType,
} from '@airbus-tools/shared';
import mongoose from 'mongoose';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import {
  UserModel,
  ProductModel,
  OrderModel,
  ConversationModel,
  MessageModel,
  PaymentModel,
  InteractionModel,
  NotificationModel,
} from './models';
import { setupTestDB, teardownTestDB, clearTestDB } from './test-utils';


describe('Mongoose Schemas & Validation', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('UserModel', () => {
    it('should validate and create a valid user with timestamps and virtual id', async () => {
      const user = await UserModel.create({
        email: 'Eng.Doe@Airbus.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'argon2_hashed_secret',
        role: UserRole.BUYER,
        status: UserStatus.ACTIVE,
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('eng.doe@airbus.com'); // normalized lowercase
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);

      const json = user.toJSON();
      expect(json.id).toBe(user.id);
      expect(json.passwordHash).toBeUndefined();
    });

    it('should reject invalid email format', async () => {
      await expect(
        UserModel.create({
          email: 'invalid-email',
          firstName: 'Jane',
          lastName: 'Doe',
          passwordHash: 'hash',
        }),
      ).rejects.toThrow();
    });

    it('should enforce unique email constraint', async () => {
      await UserModel.init(); // Ensure indexes are built
      await UserModel.create({
        email: 'duplicate@airbus.com',
        firstName: 'Jane',
        lastName: 'Doe',
        passwordHash: 'hash',
      });

      await expect(
        UserModel.create({
          email: 'duplicate@airbus.com',
          firstName: 'Another',
          lastName: 'User',
          passwordHash: 'hash2',
        }),
      ).rejects.toThrow();
    });
  });

  describe('ProductModel', () => {
    it('should validate and create product with nested dimensions and part number uppercase normalization', async () => {
      const sellerId = new mongoose.Types.ObjectId();
      const product = await ProductModel.create({
        sellerId,
        title: 'Titanium Fastener Bolt A350',
        partNumber: 'as-1234-x',
        description: 'High-strength aerospace grade titanium fastener for fuselage assembly.',
        category: ProductCategory.FASTENERS,
        condition: ProductCondition.NEW,
        status: ProductStatus.ACTIVE,
        price: 450.5,
        currency: 'USD',
        quantityAvailable: 1000,
        minimumOrderQuantity: 10,
        certifications: ['EASA Form 1', 'CoC'],
        tags: ['titanium', 'a350', 'airframe'],
        dimensions: {
          length: 50,
          width: 10,
          height: 10,
          unit: 'mm',
        },
      });

      expect(product.partNumber).toBe('AS-1234-X');
      expect(product.category).toBe(ProductCategory.FASTENERS);
      expect(product.dimensions?.length).toBe(50);
      expect(product.dimensions?.unit).toBe('mm');
    });

    it('should reject negative price or invalid quantity', async () => {
      const sellerId = new mongoose.Types.ObjectId();
      await expect(
        ProductModel.create({
          sellerId,
          title: 'Defective Price Product',
          partNumber: 'FAIL-1',
          description: 'Test',
          category: ProductCategory.FASTENERS,
          price: -10,
        }),
      ).rejects.toThrow();
    });
  });

  describe('OrderModel', () => {
    it('should create valid order with sub-items and calculate totals correctly', async () => {
      const buyerId = new mongoose.Types.ObjectId();
      const sellerId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId().toString();

      const order = await OrderModel.create({
        orderNumber: 'ord-2025-0001',
        buyerId,
        sellerId,
        status: OrderStatus.ACCEPTED,
        items: [
          {
            productId,
            partNumber: 'AS-1234-X',
            title: 'Titanium Fastener Bolt',
            unitPrice: 50,
            quantity: 2,
            totalPrice: 100,
            currency: 'USD',
          },
        ],
        subtotal: 100,
        tax: 20,
        shippingFee: 15,
        totalAmount: 135,
        currency: 'USD',
        shippingAddress: {
          street: '1 Airbus Way',
          city: 'Toulouse',
          postalCode: '31700',
          country: 'France',
        },
      });

      expect(order.orderNumber).toBe('ORD-2025-0001');
      expect(order.items).toHaveLength(1);
      expect(order.items[0]?.totalPrice).toBe(100);
    });

    it('should reject order with empty items list', async () => {
      const buyerId = new mongoose.Types.ObjectId();
      const sellerId = new mongoose.Types.ObjectId();

      await expect(
        OrderModel.create({
          orderNumber: 'ORD-EMPTY',
          buyerId,
          sellerId,
          status: OrderStatus.PENDING,
          items: [],
          subtotal: 0,
          tax: 0,
          shippingFee: 0,
          totalAmount: 0,
          currency: 'USD',
          shippingAddress: {
            street: '1 Test Road',
            city: 'London',
            postalCode: 'SW1A 1AA',
            country: 'UK',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Conversation & Message Models', () => {
    it('should create conversation with participants and messages referencing it', async () => {
      const userA = new mongoose.Types.ObjectId();
      const userB = new mongoose.Types.ObjectId();

      const conv = await ConversationModel.create({
        participants: [{ userId: userA }, { userId: userB }],
        type: ConversationType.ORDER_INQUIRY,
        title: 'RFQ Inquiry for Turbine Blades',
      });

      expect(conv.participants).toHaveLength(2);

      const message = await MessageModel.create({
        conversationId: conv._id,
        senderId: userA,
        type: MessageType.TEXT,
        content: 'Hello, what is the lead time for 50 units?',
        isReadBy: [userA],
      });

      expect(message.conversationId.toString()).toBe(conv.id);
      expect(message.content).toContain('lead time');
    });
  });

  describe('PaymentModel', () => {
    it('should create payment with required associations and status tracking', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const payerId = new mongoose.Types.ObjectId();
      const payeeId = new mongoose.Types.ObjectId();

      const payment = await PaymentModel.create({
        paymentNumber: 'pay-2025-9988',
        orderId,
        payerId,
        payeeId,
        amount: 2500,
        currency: 'USD',
        paymentMethod: PaymentMethod.ESCROW,
        status: PaymentStatus.AUTHORIZED,
        transactionReference: 'txn_stripe_escrow_123',
      });

      expect(payment.paymentNumber).toBe('PAY-2025-9988');
      expect(payment.status).toBe(PaymentStatus.AUTHORIZED);
      expect(payment.paymentMethod).toBe(PaymentMethod.ESCROW);
    });
  });

  describe('Interaction & Notification Models', () => {
    it('should create user interaction log', async () => {
      const userId = new mongoose.Types.ObjectId();
      const interaction = await InteractionModel.create({
        userId,
        type: InteractionType.VIEW,
        entityType: 'PRODUCT',
        entityId: 'PROD-100',
        metadata: { referrer: 'direct', browser: 'Chrome' },
      });

      expect(interaction.type).toBe(InteractionType.VIEW);
      expect(interaction.entityType).toBe('PRODUCT');
    });

    it('should create notification with read status tracking', async () => {
      const userId = new mongoose.Types.ObjectId();
      const notif = await NotificationModel.create({
        userId,
        type: NotificationType.ORDER_UPDATE,
        title: 'Order Confirmed',
        message: 'Your order ORD-2025-001 has been confirmed by the seller.',
        referenceEntityType: 'ORDER',
        referenceEntityId: 'ORD-2025-001',
      });

      expect(notif.isRead).toBe(false);
      expect(notif.title).toBe('Order Confirmed');
    });
  });
});
