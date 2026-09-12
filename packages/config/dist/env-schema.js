import { z } from 'zod';
import { ENVIRONMENTS } from './constants';
// Base environment schema shared across apps
export const baseEnvSchema = z.object({
    NODE_ENV: z
        .enum([ENVIRONMENTS.DEVELOPMENT, ENVIRONMENTS.TEST, ENVIRONMENTS.PRODUCTION])
        .default(ENVIRONMENTS.DEVELOPMENT),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});
/**
 * Validate and parse environment variables using a Zod schema.
 * Throws an error with a descriptive message if validation fails.
 */
export function validateEnv(schema, env = process.env) {
    const result = schema.safeParse(env);
    if (!result.success) {
        const errors = result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
        throw new Error(`Environment validation failed:\n${errors}`);
    }
    return result.data;
}
//# sourceMappingURL=env-schema.js.map