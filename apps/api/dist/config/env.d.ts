import { z } from 'zod';
declare const apiEnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
} & {
    PORT: z.ZodDefault<z.ZodNumber>;
    HOST: z.ZodDefault<z.ZodString>;
    API_PREFIX: z.ZodDefault<z.ZodString>;
    MONGODB_URI: z.ZodOptional<z.ZodString>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    CORS_ORIGIN: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    PORT: number;
    HOST: string;
    API_PREFIX: string;
    CORS_ORIGIN: string;
    NODE_ENV: "development" | "test" | "production";
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    MONGODB_URI?: string | undefined;
    REDIS_URL?: string | undefined;
}, {
    PORT?: number | undefined;
    HOST?: string | undefined;
    API_PREFIX?: string | undefined;
    MONGODB_URI?: string | undefined;
    REDIS_URL?: string | undefined;
    CORS_ORIGIN?: string | undefined;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
}>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export declare const config: {
    PORT: number;
    HOST: string;
    API_PREFIX: string;
    CORS_ORIGIN: string;
    NODE_ENV: "development" | "test" | "production";
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    MONGODB_URI?: string | undefined;
    REDIS_URL?: string | undefined;
};
export {};
//# sourceMappingURL=env.d.ts.map