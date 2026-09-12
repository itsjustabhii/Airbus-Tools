import type { ZodError, ZodType, SafeParseReturnType } from 'zod';
/**
 * Safely parse data with a Zod schema.
 * Returns { success, data } or { success, error }.
 */
export declare function safeParse<T>(schema: ZodType<T>, data: unknown): SafeParseReturnType<unknown, T>;
/**
 * Parse and throw on validation failure with structured messages.
 */
export declare function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T;
/**
 * Format Zod validation errors into a flat array of messages.
 */
export declare function formatZodErrors(error: ZodError): string[];
//# sourceMappingURL=index.d.ts.map