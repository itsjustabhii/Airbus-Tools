import { ProductCategory, ProductCondition, ProductStatus } from '@airbus-tools/shared';
import { z } from 'zod';
export declare const ALLOWED_SORT_FIELDS: readonly ["price", "createdAt", "title"];
export type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number];
export declare const listProductsQuerySchema: z.ZodObject<{
    /** Free-text search against the text index */
    search: z.ZodOptional<z.ZodString>;
    /** Filter by exact category enum value */
    category: z.ZodOptional<z.ZodNativeEnum<typeof ProductCategory>>;
    /** Filter by product condition */
    condition: z.ZodOptional<z.ZodNativeEnum<typeof ProductCondition>>;
    /** Filter by status; airlines only see ACTIVE unless otherwise specified */
    status: z.ZodOptional<z.ZodNativeEnum<typeof ProductStatus>>;
    /** Seller ID filter (suppliers see only their own listings) */
    sellerId: z.ZodOptional<z.ZodString>;
    /** Minimum price inclusive */
    minPrice: z.ZodOptional<z.ZodNumber>;
    /** Maximum price inclusive */
    maxPrice: z.ZodOptional<z.ZodNumber>;
    /** Comma-separated tags */
    tags: z.ZodEffects<z.ZodOptional<z.ZodString>, string[] | undefined, string | undefined>;
    /** Comma-separated certifications (all must be present) */
    certifications: z.ZodEffects<z.ZodOptional<z.ZodString>, string[] | undefined, string | undefined>;
    /** Cursor for next/prev page navigation */
    cursor: z.ZodOptional<z.ZodString>;
    /** Pagination direction */
    direction: z.ZodOptional<z.ZodEnum<["next", "prev"]>>;
    /** Page size — capped at 100 */
    limit: z.ZodDefault<z.ZodNumber>;
    /** Sort field — only whitelisted fields accepted */
    sortBy: z.ZodDefault<z.ZodEnum<["price", "createdAt", "title"]>>;
    /** Sort direction */
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    sortBy: "createdAt" | "title" | "price";
    sortOrder: "asc" | "desc";
    status?: ProductStatus | undefined;
    search?: string | undefined;
    cursor?: string | undefined;
    sellerId?: string | undefined;
    category?: ProductCategory | undefined;
    condition?: ProductCondition | undefined;
    certifications?: string[] | undefined;
    tags?: string[] | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    direction?: "next" | "prev" | undefined;
}, {
    status?: ProductStatus | undefined;
    search?: string | undefined;
    limit?: number | undefined;
    cursor?: string | undefined;
    sellerId?: string | undefined;
    category?: ProductCategory | undefined;
    condition?: ProductCondition | undefined;
    certifications?: string | undefined;
    tags?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    direction?: "next" | "prev" | undefined;
    sortBy?: "createdAt" | "title" | "price" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export declare const createProductSchema: z.ZodObject<{
    title: z.ZodString;
    partNumber: z.ZodString;
    oemPartNumber: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    category: z.ZodNativeEnum<typeof ProductCategory>;
    condition: z.ZodDefault<z.ZodNativeEnum<typeof ProductCondition>>;
    status: z.ZodDefault<z.ZodNativeEnum<typeof ProductStatus>>;
    price: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    quantityAvailable: z.ZodDefault<z.ZodNumber>;
    minimumOrderQuantity: z.ZodDefault<z.ZodNumber>;
    estimatedDeliveryDays: z.ZodOptional<z.ZodNumber>;
    certifications: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    dimensions: z.ZodOptional<z.ZodObject<{
        length: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        unit: z.ZodDefault<z.ZodEnum<["mm", "cm", "m", "in", "ft"]>>;
    }, "strip", z.ZodTypeAny, {
        length: number;
        width: number;
        height: number;
        unit: "m" | "mm" | "cm" | "in" | "ft";
    }, {
        length: number;
        width: number;
        height: number;
        unit?: "m" | "mm" | "cm" | "in" | "ft" | undefined;
    }>>;
    weightKg: z.ZodOptional<z.ZodNumber>;
    mediaUrls: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    status: ProductStatus;
    description: string;
    currency: string;
    title: string;
    partNumber: string;
    category: ProductCategory;
    condition: ProductCondition;
    price: number;
    quantityAvailable: number;
    minimumOrderQuantity: number;
    certifications: string[];
    tags: string[];
    mediaUrls: string[];
    oemPartNumber?: string | undefined;
    estimatedDeliveryDays?: number | undefined;
    dimensions?: {
        length: number;
        width: number;
        height: number;
        unit: "m" | "mm" | "cm" | "in" | "ft";
    } | undefined;
    weightKg?: number | undefined;
}, {
    description: string;
    title: string;
    partNumber: string;
    category: ProductCategory;
    price: number;
    status?: ProductStatus | undefined;
    currency?: string | undefined;
    oemPartNumber?: string | undefined;
    condition?: ProductCondition | undefined;
    quantityAvailable?: number | undefined;
    minimumOrderQuantity?: number | undefined;
    estimatedDeliveryDays?: number | undefined;
    certifications?: string[] | undefined;
    tags?: string[] | undefined;
    dimensions?: {
        length: number;
        width: number;
        height: number;
        unit?: "m" | "mm" | "cm" | "in" | "ft" | undefined;
    } | undefined;
    weightKg?: number | undefined;
    mediaUrls?: string[] | undefined;
}>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export declare const updateProductSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    partNumber: z.ZodOptional<z.ZodString>;
    oemPartNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodNativeEnum<typeof ProductCategory>>;
    condition: z.ZodOptional<z.ZodNativeEnum<typeof ProductCondition>>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof ProductStatus>>;
    price: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    quantityAvailable: z.ZodOptional<z.ZodNumber>;
    minimumOrderQuantity: z.ZodOptional<z.ZodNumber>;
    estimatedDeliveryDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    certifications: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dimensions: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        length: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        unit: z.ZodDefault<z.ZodEnum<["mm", "cm", "m", "in", "ft"]>>;
    }, "strip", z.ZodTypeAny, {
        length: number;
        width: number;
        height: number;
        unit: "m" | "mm" | "cm" | "in" | "ft";
    }, {
        length: number;
        width: number;
        height: number;
        unit?: "m" | "mm" | "cm" | "in" | "ft" | undefined;
    }>>>;
    weightKg: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    mediaUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    status?: ProductStatus | undefined;
    description?: string | undefined;
    currency?: string | undefined;
    title?: string | undefined;
    partNumber?: string | undefined;
    oemPartNumber?: string | null | undefined;
    category?: ProductCategory | undefined;
    condition?: ProductCondition | undefined;
    price?: number | undefined;
    quantityAvailable?: number | undefined;
    minimumOrderQuantity?: number | undefined;
    estimatedDeliveryDays?: number | null | undefined;
    certifications?: string[] | undefined;
    tags?: string[] | undefined;
    dimensions?: {
        length: number;
        width: number;
        height: number;
        unit: "m" | "mm" | "cm" | "in" | "ft";
    } | null | undefined;
    weightKg?: number | null | undefined;
    mediaUrls?: string[] | undefined;
}, {
    status?: ProductStatus | undefined;
    description?: string | undefined;
    currency?: string | undefined;
    title?: string | undefined;
    partNumber?: string | undefined;
    oemPartNumber?: string | null | undefined;
    category?: ProductCategory | undefined;
    condition?: ProductCondition | undefined;
    price?: number | undefined;
    quantityAvailable?: number | undefined;
    minimumOrderQuantity?: number | undefined;
    estimatedDeliveryDays?: number | null | undefined;
    certifications?: string[] | undefined;
    tags?: string[] | undefined;
    dimensions?: {
        length: number;
        width: number;
        height: number;
        unit?: "m" | "mm" | "cm" | "in" | "ft" | undefined;
    } | null | undefined;
    weightKg?: number | null | undefined;
    mediaUrls?: string[] | undefined;
}>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export declare const productIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
//# sourceMappingURL=products.schemas.d.ts.map