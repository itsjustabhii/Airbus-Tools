import { validateEnv, baseEnvSchema } from '@airbus-tools/config';
import { z } from 'zod';

const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/airbus-tools'),
  REDIS_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('*'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

// Validate and export the config — fails fast on misconfiguration
export const config = validateEnv(apiEnvSchema);
