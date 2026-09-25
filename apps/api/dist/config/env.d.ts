import { z } from 'zod';
declare const apiEnvSchema: z.ZodEffects<z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
} & {
    PORT: z.ZodDefault<z.ZodNumber>;
    HOST: z.ZodDefault<z.ZodString>;
    API_PREFIX: z.ZodDefault<z.ZodString>;
    MONGODB_URI: z.ZodDefault<z.ZodString>;
    REDIS_URL: z.ZodOptional<z.ZodString>;
    CORS_ORIGIN: z.ZodDefault<z.ZodString>;
    /**
     * Must be at least 32 characters. No default — must be explicitly set.
     * In production the value MUST NOT match any known insecure default.
     */
    JWT_SECRET: z.ZodString;
    JWT_EXPIRY: z.ZodDefault<z.ZodString>;
    /**
     * Must be at least 32 characters. No default — must be explicitly set.
     */
    COOKIE_SECRET: z.ZodString;
    AWS_REGION: z.ZodDefault<z.ZodString>;
    AWS_S3_BUCKET: z.ZodDefault<z.ZodString>;
    AWS_ACCESS_KEY_ID: z.ZodOptional<z.ZodString>;
    AWS_SECRET_ACCESS_KEY: z.ZodOptional<z.ZodString>;
    AWS_S3_ENDPOINT: z.ZodOptional<z.ZodString>;
    SES_FROM_ADDRESS: z.ZodDefault<z.ZodString>;
    SES_REPLY_TO: z.ZodOptional<z.ZodString>;
    /** Override the SES endpoint — useful for LocalStack in local dev. */
    AWS_SES_ENDPOINT: z.ZodOptional<z.ZodString>;
    /**
     * Selects the payment provider implementation.
     *   'mock'   → MockPaymentProvider (local dev + tests, default)
     */
    PAYMENT_PROVIDER: z.ZodDefault<z.ZodEnum<["mock"]>>;
    /**
     * Shared secret used to validate inbound webhook signatures from the
     * payment provider.  Must be set explicitly — no default.
     */
    PAYMENT_WEBHOOK_SECRET: z.ZodString;
}, "strip", z.ZodTypeAny, {
    PORT: number;
    HOST: string;
    API_PREFIX: string;
    MONGODB_URI: string;
    CORS_ORIGIN: string;
    JWT_SECRET: string;
    JWT_EXPIRY: string;
    COOKIE_SECRET: string;
    AWS_REGION: string;
    AWS_S3_BUCKET: string;
    SES_FROM_ADDRESS: string;
    PAYMENT_PROVIDER: "mock";
    PAYMENT_WEBHOOK_SECRET: string;
    NODE_ENV: "development" | "test" | "production";
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    REDIS_URL?: string | undefined;
    AWS_ACCESS_KEY_ID?: string | undefined;
    AWS_SECRET_ACCESS_KEY?: string | undefined;
    AWS_S3_ENDPOINT?: string | undefined;
    SES_REPLY_TO?: string | undefined;
    AWS_SES_ENDPOINT?: string | undefined;
}, {
    JWT_SECRET: string;
    COOKIE_SECRET: string;
    PAYMENT_WEBHOOK_SECRET: string;
    PORT?: number | undefined;
    HOST?: string | undefined;
    API_PREFIX?: string | undefined;
    MONGODB_URI?: string | undefined;
    REDIS_URL?: string | undefined;
    CORS_ORIGIN?: string | undefined;
    JWT_EXPIRY?: string | undefined;
    AWS_REGION?: string | undefined;
    AWS_S3_BUCKET?: string | undefined;
    AWS_ACCESS_KEY_ID?: string | undefined;
    AWS_SECRET_ACCESS_KEY?: string | undefined;
    AWS_S3_ENDPOINT?: string | undefined;
    SES_FROM_ADDRESS?: string | undefined;
    SES_REPLY_TO?: string | undefined;
    AWS_SES_ENDPOINT?: string | undefined;
    PAYMENT_PROVIDER?: "mock" | undefined;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
}>, {
    PORT: number;
    HOST: string;
    API_PREFIX: string;
    MONGODB_URI: string;
    CORS_ORIGIN: string;
    JWT_SECRET: string;
    JWT_EXPIRY: string;
    COOKIE_SECRET: string;
    AWS_REGION: string;
    AWS_S3_BUCKET: string;
    SES_FROM_ADDRESS: string;
    PAYMENT_PROVIDER: "mock";
    PAYMENT_WEBHOOK_SECRET: string;
    NODE_ENV: "development" | "test" | "production";
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    REDIS_URL?: string | undefined;
    AWS_ACCESS_KEY_ID?: string | undefined;
    AWS_SECRET_ACCESS_KEY?: string | undefined;
    AWS_S3_ENDPOINT?: string | undefined;
    SES_REPLY_TO?: string | undefined;
    AWS_SES_ENDPOINT?: string | undefined;
}, {
    JWT_SECRET: string;
    COOKIE_SECRET: string;
    PAYMENT_WEBHOOK_SECRET: string;
    PORT?: number | undefined;
    HOST?: string | undefined;
    API_PREFIX?: string | undefined;
    MONGODB_URI?: string | undefined;
    REDIS_URL?: string | undefined;
    CORS_ORIGIN?: string | undefined;
    JWT_EXPIRY?: string | undefined;
    AWS_REGION?: string | undefined;
    AWS_S3_BUCKET?: string | undefined;
    AWS_ACCESS_KEY_ID?: string | undefined;
    AWS_SECRET_ACCESS_KEY?: string | undefined;
    AWS_S3_ENDPOINT?: string | undefined;
    SES_FROM_ADDRESS?: string | undefined;
    SES_REPLY_TO?: string | undefined;
    AWS_SES_ENDPOINT?: string | undefined;
    PAYMENT_PROVIDER?: "mock" | undefined;
    NODE_ENV?: "development" | "test" | "production" | undefined;
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
}>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export declare const config: {
    PORT: number;
    HOST: string;
    API_PREFIX: string;
    MONGODB_URI: string;
    CORS_ORIGIN: string;
    JWT_SECRET: string;
    JWT_EXPIRY: string;
    COOKIE_SECRET: string;
    AWS_REGION: string;
    AWS_S3_BUCKET: string;
    SES_FROM_ADDRESS: string;
    PAYMENT_PROVIDER: "mock";
    PAYMENT_WEBHOOK_SECRET: string;
    NODE_ENV: "development" | "test" | "production";
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    REDIS_URL?: string | undefined;
    AWS_ACCESS_KEY_ID?: string | undefined;
    AWS_SECRET_ACCESS_KEY?: string | undefined;
    AWS_S3_ENDPOINT?: string | undefined;
    SES_REPLY_TO?: string | undefined;
    AWS_SES_ENDPOINT?: string | undefined;
};
export {};
//# sourceMappingURL=env.d.ts.map