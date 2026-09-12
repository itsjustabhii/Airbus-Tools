import type { ZodError, ZodType, SafeParseReturnType } from 'zod';

/**
 * Safely parse data with a Zod schema.
 * Returns { success, data } or { success, error }.
 */
export function safeParse<T>(schema: ZodType<T>, data: unknown): SafeParseReturnType<unknown, T> {
  return schema.safeParse(data);
}

/**
 * Parse and throw on validation failure with structured messages.
 */
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Format Zod validation errors into a flat array of messages.
 */
export function formatZodErrors(error: ZodError): string[] {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
}
