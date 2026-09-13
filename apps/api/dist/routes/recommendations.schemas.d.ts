import { z } from 'zod';
export declare const getRecommendationsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export type GetRecommendationsQuery = z.infer<typeof getRecommendationsQuerySchema>;
export declare const recordInteractionBodySchema: z.ZodObject<{
    type: z.ZodEnum<["viewed", "contacted", "requested", "ordered"]>;
    /** Product ID for viewed / contacted / requested; Order ID for ordered */
    entityId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "ordered" | "viewed" | "contacted" | "requested";
    entityId: string;
}, {
    type: "ordered" | "viewed" | "contacted" | "requested";
    entityId: string;
}>;
export type RecordInteractionBody = z.infer<typeof recordInteractionBodySchema>;
//# sourceMappingURL=recommendations.schemas.d.ts.map