import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import { database } from './connection';

let mongod: MongoMemoryServer;

export async function setupTestDB(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await database.connect({ uri, maxRetries: 1 });
}

export async function teardownTestDB(): Promise<void> {
  await database.disconnect();
  if (mongod) {
    await mongod.stop();
  }
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    if (collection) {
      await collection.deleteMany({});
    }
  }
}
