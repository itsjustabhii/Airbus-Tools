"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const env_1 = require("../config/env");
const isDev = env_1.config.NODE_ENV === 'development';
/**
 * Fields to redact from all log lines.
 * This prevents PII (passwords, tokens, secrets) from appearing in log files
 * even when debug-level logging is enabled.
 */
const REDACT_PATHS = [
    'password',
    'passwordHash',
    'currentPassword',
    'newPassword',
    '*.password',
    '*.passwordHash',
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.password',
    'req.body.currentPassword',
    'req.body.newPassword',
];
exports.logger = (0, pino_1.default)({
    level: env_1.config.LOG_LEVEL,
    redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
    },
    ...(isDev && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    }),
});
//# sourceMappingURL=logger.js.map