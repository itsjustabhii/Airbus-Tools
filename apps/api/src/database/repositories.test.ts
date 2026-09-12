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
  userRepository,
  productRepository,
  orderRepository,
  conversationRepository,
  messageRepository,
  paymentRepository,
  interactionRepository,
  notificationRepository,
} from './repositories';
import { setupTestDB, teardownTestDB, clearTestDB } from './test-utils';


describe('Repository Layer Operations', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('UserRepository', () => {
    it('should create, findByEmail, check existence and perform paginated search', async () => {
      const user = await userRepository.create({
        email: 'alice@airbus.com',
        firstName: 'Alice',
        lastName: 'Smith',
        passwordHash: 'secret_hash',
        role: UserRole.SELLER,
        status: UserStatus.ACTIVE,
      });

      const found = await userRepository.findByEmail('alice@airbus.com');
      expect(found?.id).toBe(user.id);

      const exists = await userRepository.emailExists('Alice@Airbus.com');
      expect(exists).toBe(true);

      const searchResult = await userRepository.searchUsers({
        role: UserRole.SELLER,
        search: 'Alice',
      });
      expect(searchResult.total).toBe(1);
      expect(searchResult.items[0]?.email).toBe('alice@airbus.com');

      await userRepository.updateLastLogin(user.id as string);
      const updated = await userRepository.findById(user.id as string);
      expect(updated?.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe('ProductRepository', () => {
    it('should create product, search catalog with filters, and manage inventory atomically', async () => {
      const sellerId = new mongoose.Types.ObjectId();

      const prod = await productRepository.create({
        sellerId,
        title: 'Airbus A320 Fuel Pump',
        partNumber: 'FP-A320-99',
        description: 'Original OEM fuel pump assembly for Airbus A320.',
        category: ProductCategory.PROPULSION,
        condition: ProductCondition.NEW,
        status: ProductStatus.ACTIVE,
        price: 12500,
        currency: 'USD',
        quantityAvailable: 5,
        minimumOrderQuantity: 1,
        tags: ['fuel', 'pump', 'a320'],
      });

      const byPn = await productRepository.findByPartNumber('FP-A320-99');
      expect(byPn).toHaveLength(1);
      expect(byPn[0]?.title).toBe('Airbus A320 Fuel Pump');

      const search = await productRepository.searchCatalog({
        category: ProductCategory.PROPULSION,
        minPrice: 10000,
        maxPrice: 15000,
        status: ProductStatus.ACTIVE,
      });
      expect(search.total).toBe(1);

      // Inventory decrement
      const afterDecrement = await productRepository.updateInventory(prod.id as string, -2);
      expect(afterDecrement?.quantityAvailable).toBe(3);

      // Should fail if trying to decrement more than available
      const failedDecrement = await productRepository.updateInventory(prod.id as string, -10);
      expect(failedDecrement).toBeNull();
    });
  });

  describe('OrderRepository', () => {
    it('should manage order lifecycle transitions and query by buyer/seller', async () => {
      const buyerId = new mongoose.Types.ObjectId();
      const sellerId = new mongoose.Types.ObjectId();

      const order = await orderRepository.create({
        orderNumber: 'ORD-AIR-001',
        buyerId,
        sellerId,
        status: OrderStatus.PENDING,
        items: [
          {
            productId: new mongoose.Types.ObjectId().toString(),
            partNumber: 'FP-A320-99',
            title: 'Fuel Pump',
            unitPrice: 12500,
            quantity: 1,
            totalPrice: 12500,
            currency: 'USD',
          },
        ],
        subtotal: 12500,
        tax: 2500,
        shippingFee: 150,
        totalAmount: 15150,
        currency: 'USD',
        shippingAddress: {
          street: 'Aerospace Blvd 10',
          city: 'Hamburg',
          postalCode: '21129',
          country: 'Germany',
        },
      });

      expect(order.orderNumber).toBe('ORD-AIR-001');

      const byBuyer = await orderRepository.findByBuyer(buyerId.toString());
      expect(byBuyer.total).toBe(1);

      const updated = await orderRepository.updateStatus(order.id as string, OrderStatus.ACCEPTED, {
        placedAt: new Date(),
      });
      expect(updated?.status).toBe(OrderStatus.ACCEPTED);
      expect(updated?.placedAt).toBeInstanceOf(Date);
    });
  });

  describe('Conversation & Message Repositories', () => {
    it('should support messaging flows and unread counters', async () => {
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();

      const conv = await conversationRepository.create({
        participants: [
          { userId: user1 },
          { userId: user2 },
        ],
        type: ConversationType.DIRECT,
        title: 'Direct negotiation',
      });

      expect(conv.id).toBeDefined();

      await messageRepository.create({
        conversationId: conv._id,
        senderId: user1,
        type: MessageType.TEXT,
        content: 'Can you provide the CoC certificate?',
        isReadBy: [user1],
      });

      await conversationRepository.updateLastMessage(conv.id as string, 'Can you provide the CoC certificate?');

      const unreadCount = await messageRepository.countUnreadInConversation(conv.id as string, user2.toString());
      expect(unreadCount).toBe(1);

      await messageRepository.markAllInConversationAsRead(conv.id as string, user2.toString());
      const afterReadCount = await messageRepository.countUnreadInConversation(conv.id as string, user2.toString());
      expect(afterReadCount).toBe(0);

      const userConvs = await conversationRepository.findUserConversations(user1.toString());
      expect(userConvs.total).toBe(1);
    });
  });

  describe('PaymentRepository', () => {
    it('should track payment statuses and lookup by payment number', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const payerId = new mongoose.Types.ObjectId();
      const payeeId = new mongoose.Types.ObjectId();

      const payment = await paymentRepository.create({
        paymentNumber: 'PAY-ORD-001',
        orderId,
        payerId,
        payeeId,
        amount: 15150,
        currency: 'USD',
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
      });

      const found = await paymentRepository.findByPaymentNumber('PAY-ORD-001');
      expect(found?.id).toBe(payment.id);

      const updated = await paymentRepository.updateStatus(payment.id as string, PaymentStatus.CAPTURED, {
        paidAt: new Date(),
        transactionReference: 'WIRE-992109',
      });
      expect(updated?.status).toBe(PaymentStatus.CAPTURED);
      expect(updated?.transactionReference).toBe('WIRE-992109');
    });
  });

  describe('Interaction & Notification Repositories', () => {
    it('should log interactions and aggregate view counts', async () => {
      const prodId = 'PROD-A350-99';
      await interactionRepository.logInteraction({
        type: InteractionType.VIEW,
        entityType: 'PRODUCT',
        entityId: prodId,
      });
      await interactionRepository.logInteraction({
        type: InteractionType.VIEW,
        entityType: 'PRODUCT',
        entityId: prodId,
      });

      const count = await interactionRepository.countEntityInteractions('PRODUCT', prodId, InteractionType.VIEW);
      expect(count).toBe(2);

      const views = await interactionRepository.getProductViewCounts([prodId]);
      expect(views).toHaveLength(1);
      expect(views[0]?.count).toBe(2);
    });

    it('should manage notifications and read markers', async () => {
      const userId = new mongoose.Types.ObjectId();

      const notif = await notificationRepository.create({
        userId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Maintenance notice',
        message: 'System maintenance scheduled tonight.',
      });

      const unreadCount = await notificationRepository.countUnread(userId.toString());
      expect(unreadCount).toBe(1);

      await notificationRepository.markAsRead(notif.id as string, userId.toString());
      const afterReadCount = await notificationRepository.countUnread(userId.toString());
      expect(afterReadCount).toBe(0);
    });
  });
});
