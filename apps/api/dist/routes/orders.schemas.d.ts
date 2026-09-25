import { OrderStatus } from '@airbus-tools/shared';
import { z } from 'zod';
export declare const shippingAddressSchema: z.ZodObject<{
    street: z.ZodString;
    city: z.ZodString;
    state: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodString;
    country: z.ZodString;
}, "strip", z.ZodTypeAny, {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    state?: string | undefined;
}, {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    state?: string | undefined;
}>;
export declare const orderItemInputSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantity: number;
}, {
    productId: string;
    quantity: number;
}>;
export declare const createOrderSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
    }, {
        productId: string;
        quantity: number;
    }>, "many">;
    shippingAddress: z.ZodObject<{
        street: z.ZodString;
        city: z.ZodString;
        state: z.ZodOptional<z.ZodString>;
        postalCode: z.ZodString;
        country: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    }, {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    }>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        productId: string;
        quantity: number;
    }[];
    shippingAddress: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    };
    notes?: string | undefined;
}, {
    items: {
        productId: string;
        quantity: number;
    }[];
    shippingAddress: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        state?: string | undefined;
    };
    notes?: string | undefined;
}>;
export type CreateOrderBody = z.infer<typeof createOrderSchema>;
export declare const transitionOrderSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof OrderStatus>;
    rejectionReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: OrderStatus;
    rejectionReason?: string | undefined;
}, {
    status: OrderStatus;
    rejectionReason?: string | undefined;
}>;
export type TransitionOrderBody = z.infer<typeof transitionOrderSchema>;
export declare const listOrdersQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodNativeEnum<typeof OrderStatus>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    startDate: z.ZodOptional<z.ZodDate>;
    endDate: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    status?: OrderStatus | undefined;
    endDate?: Date | undefined;
    startDate?: Date | undefined;
}, {
    status?: OrderStatus | undefined;
    limit?: number | undefined;
    page?: number | undefined;
    endDate?: Date | undefined;
    startDate?: Date | undefined;
}>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export declare const orderIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
//# sourceMappingURL=orders.schemas.d.ts.map