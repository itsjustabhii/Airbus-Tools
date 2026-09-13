import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // MongoDB Memory Server can take a while to download on first run
    hookTimeout: 120_000,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    // Provide required secrets for the test environment so env-schema validation passes.
    // These are test-only values — the superRefine production guard only fires when NODE_ENV=production.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars!!',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-chars!!',
      PAYMENT_WEBHOOK_SECRET: 'test-payment-webhook-secret',
    },
  },
});
