import { validateEnv, baseEnvSchema } from '@airbus-tools/config';
import { z } from 'zod';

const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/airbus-tools'),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default('change-me-in-production-at-least-32-chars!!'),
  JWT_EXPIRY: z.string().default('15m'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters').default('change-me-in-production-at-least-32-chars!!'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().default('airbus-tools-uploads'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),
  // ── Amazon SES ──────────────────────────────────────────────────────────────
  SES_FROM_ADDRESS: z.string().email().default('noreply@airbus-tools.example.com'),
  SES_REPLY_TO: z.string().email().optional(),
  /** Override the SES endpoint — useful for LocalStack in local dev. */
  AWS_SES_ENDPOINT: z.string().url().optional(),
  // ── Payments ─────────────────────────────────────────────────────────────────
  /**
   * Selects the payment provider implementation.
   *   'mock'   → MockPaymentProvider (local dev + tests, default)
   */
  PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),
  /**
   * Shared secret used to validate inbound webhook signatures from the
   * payment provider.  Must be set in production.
   */
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('change-me-payment-webhook-secret'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

// Validate and export the config — fails fast on misconfiguration
export const config = validateEnv(apiEnvSchema);
