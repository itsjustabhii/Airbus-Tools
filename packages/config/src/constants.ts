// Shared configuration constants

export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  TEST: 'test',
  PRODUCTION: 'production',
} as const;

export type Environment = (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];

export const DEFAULT_PORT = 3000;
export const DEFAULT_API_PREFIX = '/api/v1';
