import supertest from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '../app';

const app = createApp();
const request = supertest(app);

describe('Health endpoints', () => {
  describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
      const res = await request.get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        data: { status: 'ok' },
      });
    });

    it('includes app name and version', async () => {
      const res = await request.get('/health');
      expect(res.body.data).toHaveProperty('app');
      expect(res.body.data).toHaveProperty('version');
      expect(res.body.data).toHaveProperty('timestamp');
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
