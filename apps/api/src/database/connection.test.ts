import { MongoMemoryServer } from 'mongodb-memory-server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { database } from './connection';

describe('Database Connection Management', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
  });

  afterAll(async () => {
    await database.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  it('should connect with retry mechanism and return healthy status', async () => {
    const uri = mongod.getUri();
    await database.connect({
      uri,
      maxRetries: 2,
      retryIntervalMS: 100,
      maxPoolSize: 20,
      minPoolSize: 5,
    });

    expect(database.isConnected()).toBe(true);
    expect(database.getConnectionState()).toBe('connected');

    const health = await database.getHealthStatus();
    expect(health.status).toBe('healthy');
    expect(health.state).toBe('connected');
    expect(health.readyState).toBe(1);
    expect(health.pingTimeMs).toBeDefined();
    expect(health.pingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should disconnect cleanly', async () => {
    await database.disconnect();
    expect(database.isConnected()).toBe(false);

    const health = await database.getHealthStatus();
    expect(health.status).toBe('unhealthy');
    expect(health.state).toBe('disconnected');
    expect(health.readyState).toBe(0);
  });
});
