/**
 * Safely parse data with a Zod schema.
 * Returns { success, data } or { success, error }.
 */
export function safeParse(schema, data) {
    return schema.safeParse(data);
}
/**
 * Parse and throw on validation failure with structured messages.
 */
export function parseOrThrow(schema, data) {
    return schema.parse(data);
}
/**
 * Format Zod validation errors into a flat array of messages.
 */
export function formatZodErrors(error) {
    return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
}
//# sourceMappingURL=index.js.map