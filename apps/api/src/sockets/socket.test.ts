import { createServer, type Server as HttpServer } from 'http';

import { ConversationType, MessageType } from '@airbus-tools/shared';
import mongoose from 'mongoose';
import { type Server as SocketServer } from 'socket.io';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import { signToken } from '../auth/jwt';
import { ConversationModel } from '../database/models/Conversation';
import { MessageModel } from '../database/models/Message';
import { setupTestDB, teardownTestDB, clearTestDB } from '../database/test-utils';

import { authorizeUserForConversation } from './middleware';
import { initSocketServer, resetSocketServer } from './socketServer';
import { generateRoomId, getConversationRoomId } from './utils';

describe('Phase 7: Real-Time Messaging Tests', () => {
  // ── Section 1: Deterministic Room Generation ─────────────────────────────
  describe('Deterministic Room ID Generation', () => {
    it('generates a 64-character SHA-256 hex string', () => {
      const u1 = '66cf40bc973e72cf1e6cfbe0';
      const u2 = '66cf40bc973e72cf1e6cfbe1';
      const roomId = generateRoomId(u1, u2);

      expect(roomId).toBeDefined();
      expect(typeof roomId).toBe('string');
      expect(roomId).toHaveLength(64);
      expect(roomId).toMatch(/^[0-9a-f]{64}$/);
    });

    it('guarantees that generateRoomId(A, B) === generateRoomId(B, A)', () => {
      const u1 = '66cf40bc973e72cf1e6cfbe0';
      const u2 = '66cf40bc973e72cf1e6cfbe1';

      const roomIdA = generateRoomId(u1, u2);
      const roomIdB = generateRoomId(u2, u1);

      expect(roomIdA).toBe(roomIdB);
    });

    it('generates different room IDs for different pairs of users', () => {
      const u1 = '66cf40bc973e72cf1e6cfbe0';
      const u2 = '66cf40bc973e72cf1e6cfbe1';
      const u3 = '66cf40bc973e72cf1e6cfbe2';

      const r12 = generateRoomId(u1, u2);
      const r13 = generateRoomId(u1, u3);

      expect(r12).not.toBe(r13);
    });

    it('resolves deterministic room IDs for direct 2-participant conversations', () => {
      const u1 = new mongoose.Types.ObjectId();
      const u2 = new mongoose.Types.ObjectId();

      const mockConversation = {
        id: 'mock-conv-id',
        type: ConversationType.DIRECT,
        participants: [{ userId: u1 }, { userId: u2 }],
      };

      const expectedRoomId = generateRoomId(u1.toString(), u2.toString());
      const resolvedRoomId = getConversationRoomId(mockConversation);

      expect(resolvedRoomId).toBe(expectedRoomId);
    });

    it('resolves conversation database _id for non-direct or multi-participant conversations', () => {
      const mockId = new mongoose.Types.ObjectId();
      const mockConversation = {
        _id: mockId,
        type: ConversationType.ORDER_INQUIRY,
        participants: [
          { userId: new mongoose.Types.ObjectId() },
          { userId: new mongoose.Types.ObjectId() },
          { userId: new mongoose.Types.ObjectId() },
        ],
      };

      const resolvedRoomId = getConversationRoomId(mockConversation);
      expect(resolvedRoomId).toBe(mockId.toString());
    });
  });

  // ── Section 2: Database Dependent Tests (Authorization & Lifecycle) ─────────
  describe('Database Dependent Logic', () => {
    let userAId: string;
    let userBId: string;
    let userCId: string;
    let testConversationId: string;

    beforeAll(async () => {
      await setupTestDB();
    });

    afterAll(async () => {
      await teardownTestDB();
    });

    beforeEach(async () => {
      await clearTestDB();

      // Set up test IDs
      userAId = new mongoose.Types.ObjectId().toString();
      userBId = new mongoose.Types.ObjectId().toString();
      userCId = new mongoose.Types.ObjectId().toString();

      // Create a conversation with User A and User B
      const conv = await ConversationModel.create({
        type: ConversationType.DIRECT,
        participants: [{ userId: userAId }, { userId: userBId }],
      });
      testConversationId = conv._id.toString();
    });

    describe('Conversation Authorization Middleware Helper', () => {
      it('returns true if the user is a participant of the conversation', async () => {
        const isAuthorizedA = await authorizeUserForConversation(userAId, testConversationId);
        const isAuthorizedB = await authorizeUserForConversation(userBId, testConversationId);

        expect(isAuthorizedA).toBe(true);
        expect(isAuthorizedB).toBe(true);
      });

      it('returns false if the user is not a participant of the conversation', async () => {
        const isAuthorizedC = await authorizeUserForConversation(userCId, testConversationId);
        expect(isAuthorizedC).toBe(false);
      });

      it('returns false if the conversation does not exist', async () => {
        const fakeConvId = new mongoose.Types.ObjectId().toString();
        const isAuthorized = await authorizeUserForConversation(userAId, fakeConvId);
        expect(isAuthorized).toBe(false);
      });

      it('returns false for invalid inputs', async () => {
        const isAuthorized = await authorizeUserForConversation('', '');
        expect(isAuthorized).toBe(false);
      });
    });

    // ── Section 3: Integration Tests via Socket.io Server ────────────────────
    describe('Socket.io Real-Time Server Integration', () => {
      let httpServer: HttpServer;
      let io: SocketServer;
      let clientA: ClientSocket;
      let clientB: ClientSocket;
      let clientC: ClientSocket;
      let port: number;

      beforeEach(async () => {
        // Start an ephemeral HTTP server
        httpServer = createServer();
        io = await initSocketServer(httpServer);
        
        await new Promise<void>((resolve) => {
          httpServer.listen(0, () => {
            const addr = httpServer.address();
            port = typeof addr === 'string' ? 0 : addr?.port || 0;
            resolve();
          });
        });

        // Sign tokens for users
        const tokenA = signToken({ sub: userAId, email: 'usera@example.com', role: 'BUYER' });
        const tokenB = signToken({ sub: userBId, email: 'userb@example.com', role: 'SELLER' });
        const tokenC = signToken({ sub: userCId, email: 'userc@example.com', role: 'BUYER' });

        // Connect clients
        clientA = Client(`http://localhost:${port}`, {
          auth: { token: tokenA },
          transports: ['websocket'],
          forceNew: true,
        });

        clientB = Client(`http://localhost:${port}`, {
          auth: { token: tokenB },
          transports: ['websocket'],
          forceNew: true,
        });

        clientC = Client(`http://localhost:${port}`, {
          auth: { token: tokenC },
          transports: ['websocket'],
          forceNew: true,
        });

        // Wait for all clients to connect
        await Promise.all([
          new Promise<void>((res) => clientA.on('connect', res)),
          new Promise<void>((res) => clientB.on('connect', res)),
          new Promise<void>((res) => clientC.on('connect', res)),
        ]);
      });

      afterEach(async () => {
        // Disconnect clients
        if (clientA?.connected) clientA.disconnect();
        if (clientB?.connected) clientB.disconnect();
        if (clientC?.connected) clientC.disconnect();

        // Close Socket.io and HTTP servers
        io.close();
        await new Promise<void>((resolve) => {
          httpServer.close(() => resolve());
        });

        // Reset the server instance singleton so it can be re-initialized
        resetSocketServer();
        
        // Wait briefly for resources to release
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      it('authenticates connections successfully and rejects unauthenticated connections', async () => {
        const badClient = Client(`http://localhost:${port}`, {
          auth: { token: 'invalid-token-value' },
          transports: ['websocket'],
          forceNew: true,
        });

        const connectErrorPromise = new Promise<string>((resolve) => {
          badClient.on('connect_error', (err) => {
            resolve(err.message);
          });
        });

        const msg = await connectErrorPromise;
        expect(msg).toContain('Authentication error');
        badClient.disconnect();
      });

      it('allows authorized users to join a conversation room', async () => {
        const response: any = await new Promise((resolve) => {
          clientA.emit('join_conversation', { conversationId: testConversationId }, resolve);
        });

        expect(response.success).toBe(true);
        expect(response.roomId).toBe(generateRoomId(userAId, userBId));
      });

      it('prevents unauthorized users from joining a conversation room', async () => {
        const response: any = await new Promise((resolve) => {
          clientC.emit('join_conversation', { conversationId: testConversationId }, resolve);
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('Unauthorized');
      });

      it('creates and joins a direct conversation on demand', async () => {
        const response: any = await new Promise((resolve) => {
          clientA.emit('join_direct_conversation', { recipientId: userCId }, resolve);
        });

        expect(response.success).toBe(true);
        expect(response.conversation).toBeDefined();
        expect(response.conversation.type).toBe(ConversationType.DIRECT);
        expect(response.roomId).toBe(generateRoomId(userAId, userCId));

        // Check if database contains this new conversation
        const saved = await ConversationModel.findById(response.conversation.id);
        expect(saved).not.toBeNull();
        expect(saved?.participants).toHaveLength(2);
      });

      it('implements the complete Message Lifecycle: authenticate, validate, authorize, persist, and broadcast', async () => {
        // Step 1: Join rooms
        await new Promise((res) => clientA.emit('join_conversation', { conversationId: testConversationId }, res));
        await new Promise((res) => clientB.emit('join_conversation', { conversationId: testConversationId }, res));

        // Set up promise to await the broadcast event on recipient Client B
        const receiveMessagePromise = new Promise<any>((resolve) => {
          clientB.on('message_received', (msg) => {
            resolve(msg);
          });
        });

        const msgPayload = {
          conversationId: testConversationId,
          content: 'Hello, User B! This is an end-to-end real-time test.',
          type: MessageType.TEXT,
        };

        // Step 2-4: Send message, validate, authorize, persist and return success
        const sendResponse: any = await new Promise((resolve) => {
          clientA.emit('send_message', msgPayload, resolve);
        });

        expect(sendResponse.success).toBe(true);
        expect(sendResponse.message).toBeDefined();
        expect(sendResponse.message.content).toBe(msgPayload.content);
        expect(sendResponse.message.senderId).toBe(userAId);
        expect(sendResponse.message.conversationId).toBe(testConversationId);

        // Verify message persistence in MongoDB
        const persistedMessage = await MessageModel.findById(sendResponse.message.id);
        expect(persistedMessage).not.toBeNull();
        expect(persistedMessage?.content).toBe(msgPayload.content);
        expect(persistedMessage?.senderId.toString()).toBe(userAId);

        // Verify conversation snippet was updated
        const updatedConv = await ConversationModel.findById(testConversationId);
        expect(updatedConv?.lastMessageSnippet).toBe(msgPayload.content.substring(0, 300));

        // Step 5: Verify broadcast was received in real-time by Client B
        const receivedMessage = await receiveMessagePromise;
        expect(receivedMessage).toBeDefined();
        expect(receivedMessage.id).toBe(sendResponse.message.id);
        expect(receivedMessage.content).toBe(msgPayload.content);
        expect(receivedMessage.senderId).toBe(userAId);
      });

      it('blocks sending messages with invalid payloads (Zod validation)', async () => {
        const invalidPayload = {
          conversationId: testConversationId,
          content: '', // Empty content fails schema
          type: 'INVALID_TYPE',
        };

        const response: any = await new Promise((resolve) => {
          clientA.emit('send_message', invalidPayload, resolve);
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('Validation failed');
      });

      it('blocks unauthorized users from sending messages to a conversation', async () => {
        const payload = {
          conversationId: testConversationId,
          content: 'I am spamming this chat!',
          type: MessageType.TEXT,
        };

        const response: any = await new Promise((resolve) => {
          clientC.emit('send_message', payload, resolve);
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('Unauthorized');
      });

      it('updates read states, increments unread counts, and broadcasts read receipts', async () => {
        // Send a message first
        const msg = await MessageModel.create({
          conversationId: testConversationId,
          senderId: userAId,
          type: MessageType.TEXT,
          content: 'Test unread message',
          isReadBy: [userAId],
        });

        // Verify unread count is 1 for User B
        const countRes: any = await new Promise((res) => {
          clientB.emit('get_unread_count', { conversationId: testConversationId }, res);
        });
        expect(countRes.success).toBe(true);
        expect(countRes.unreadCount).toBe(1);

        // Join room B and set up read receipt promise on A
        await new Promise((res) => clientA.emit('join_conversation', { conversationId: testConversationId }, res));
        await new Promise((res) => clientB.emit('join_conversation', { conversationId: testConversationId }, res));

        const readReceiptPromise = new Promise<any>((resolve) => {
          clientA.on('messages_read', (receipt) => {
            resolve(receipt);
          });
        });

        // Call mark_as_read
        const readRes: any = await new Promise((res) => {
          clientB.emit('mark_as_read', { conversationId: testConversationId }, res);
        });

        expect(readRes.success).toBe(true);
        expect(readRes.modifiedCount).toBe(1);

        // Verify read receipt was broadcast to Client A
        const receipt = await readReceiptPromise;
        expect(receipt).toBeDefined();
        expect(receipt.conversationId).toBe(testConversationId);
        expect(receipt.userId).toBe(userBId);

        // Verify message is now read in DB
        const updatedMsg = await MessageModel.findById(msg._id);
        expect(updatedMsg?.isReadBy.map(id => id.toString())).toContain(userBId);
      });

      it('supports reconnect behavior: rejoining rooms and fetching missed messages', async () => {
        // Join conversation initially
        await new Promise((res) => clientA.emit('join_conversation', { conversationId: testConversationId }, res));

        // Disconnect and reconnect User A
        clientA.disconnect();
        
        // While disconnected, User B sends a message
        const msg = await MessageModel.create({
          conversationId: testConversationId,
          senderId: userBId,
          type: MessageType.TEXT,
          content: 'Sent while User A was offline',
          isReadBy: [userBId],
        });

        // Reconnect User A
        const tokenA = signToken({ sub: userAId, email: 'usera@example.com', role: 'BUYER' });
        clientA = Client(`http://localhost:${port}`, {
          auth: { token: tokenA },
          transports: ['websocket'],
          forceNew: true,
        });
        await new Promise<void>((res) => clientA.on('connect', res));

        // Rejoin conversations using bulk endpoint
        const rejoinRes: any = await new Promise((res) => {
          clientA.emit('rejoin_conversations', { conversationIds: [testConversationId] }, res);
        });

        expect(rejoinRes.success).toBe(true);
        expect(rejoinRes.rejoinedConversationIds).toContain(testConversationId);

        // Fetch missed message history since message's timestamp or just historical messages
        const historyRes: any = await new Promise((res) => {
          clientA.emit('get_message_history', { conversationId: testConversationId, limit: 10 }, res);
        });

        expect(historyRes.success).toBe(true);
        expect(historyRes.messages).toHaveLength(1);
        expect(historyRes.messages[0].id).toBe(msg._id.toString());
        expect(historyRes.messages[0].content).toBe('Sent while User A was offline');
      });
    });
  });
});
