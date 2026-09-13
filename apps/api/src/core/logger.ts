import pino from 'pino';

import { config } from '../config/env';

const isDev = config.NODE_ENV === 'development';

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

export const logger = pino({
  level: config.LOG_LEVEL,
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
