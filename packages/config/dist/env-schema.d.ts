import { z } from 'zod';
export declare const baseEnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
}, {
    NODE_ENV?: "development" | "test" | "production" | undefined;
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
}>;
export type BaseEnv = z.infer<typeof baseEnvSchema>;
/**
 * Validate and parse environment variables using a Zod schema.
 * Throws an error with a descriptive message if validation fails.
 */
export declare function validateEnv<TOutput extends BaseEnv, TInput>(schema: z.ZodType<TOutput, z.ZodTypeDef, TInput>, env?: NodeJS.ProcessEnv): TOutput;
//# sourceMappingURL=env-schema.d.ts.map