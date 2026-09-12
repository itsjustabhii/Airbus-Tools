"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const config_1 = require("@airbus-tools/config");
const zod_1 = require("zod");
const apiEnvSchema = config_1.baseEnvSchema.extend({
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    HOST: zod_1.z.string().default('0.0.0.0'),
    API_PREFIX: zod_1.z.string().default('/api/v1'),
    MONGODB_URI: zod_1.z.string().default('mongodb://localhost:27017/airbus-tools'),
    REDIS_URL: zod_1.z.string().optional(),
    CORS_ORIGIN: zod_1.z.string().default('*'),
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET must be at least 32 characters').default('change-me-in-production-at-least-32-chars!!'),
    JWT_EXPIRY: zod_1.z.string().default('15m'),
    COOKIE_SECRET: zod_1.z.string().min(32, 'COOKIE_SECRET must be at least 32 characters').default('change-me-in-production-at-least-32-chars!!'),
    AWS_REGION: zod_1.z.string().default('us-east-1'),
    AWS_S3_BUCKET: zod_1.z.string().default('airbus-tools-uploads'),
    AWS_ACCESS_KEY_ID: zod_1.z.string().optional(),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    AWS_S3_ENDPOINT: zod_1.z.string().optional(),
});
// Validate and export the config — fails fast on misconfiguration
exports.config = (0, config_1.validateEnv)(apiEnvSchema);
//# sourceMappingURL=env.js.map