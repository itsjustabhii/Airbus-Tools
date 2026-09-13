import supertest from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createApp } from '../app';
import { setupTestDB, teardownTestDB } from '../database/test-utils';


const app = createApp();
const request = supertest(app);

describe('Health endpoints', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
      const res = await request.get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        data: { status: 'ok' },
      });
    });

    it('includes app name and timestamp (version omitted to avoid fingerprinting)', async () => {
      const res = await request.get('/health');
      expect(res.body.data).toHaveProperty('app');
      expect(res.body.data).toHaveProperty('timestamp');
      // version is intentionally not exposed to prevent fingerprinting
      expect(res.body.data).not.toHaveProperty('version');
    });
  });

  describe('GET /ready', () => {
    it('returns 200 with ready status', async () => {
      const res = await request.get('/ready');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        data: { status: 'ready' },
      });
    });
  });

  describe('GET /unknown-route', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request.get('/unknown-route-xyz');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
