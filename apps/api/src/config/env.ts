import { validateEnv, baseEnvSchema } from '@airbus-tools/config';
import { z } from 'zod';

/**
 * Known insecure default values that MUST NOT be used in production.
 * If any of these are detected when NODE_ENV=production the process refuses to start.
 */
const INSECURE_DEFAULTS = [
  'change-me-in-production-at-least-32-chars!!',
  'change-me-payment-webhook-secret',
];

const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/airbus-tools'),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
  /**
   * Must be at least 32 characters. No default — must be explicitly set.
   * In production the value MUST NOT match any known insecure default.
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('15m'),
  /**
   * Must be at least 32 characters. No default — must be explicitly set.
   */
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
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
   * payment provider.  Must be set explicitly — no default.
   */
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV !== 'production') return;

  const secretFields: Array<{ key: keyof typeof data; label: string }> = [
    { key: 'JWT_SECRET',             label: 'JWT_SECRET' },
    { key: 'COOKIE_SECRET',          label: 'COOKIE_SECRET' },
    { key: 'PAYMENT_WEBHOOK_SECRET', label: 'PAYMENT_WEBHOOK_SECRET' },
  ];

  for (const { key, label } of secretFields) {
    const value = data[key] as string | undefined;
    if (!value) continue; // already caught by .min() above
    if (INSECURE_DEFAULTS.includes(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${label} must not use the insecure default value in production`,
      });
    }
  }

  // Reject wildcard CORS in production
  if (data.CORS_ORIGIN === '*') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGIN'],
      message: 'CORS_ORIGIN must not be a wildcard (*) in production',
    });
  }
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

// Validate and export the config — fails fast on misconfiguration
export const config = validateEnv(apiEnvSchema);
