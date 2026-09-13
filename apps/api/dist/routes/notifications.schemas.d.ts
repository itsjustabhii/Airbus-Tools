import { z } from 'zod';
export declare const listNotificationsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    isRead: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "true" | "false">>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    isRead?: boolean | undefined;
}, {
    limit?: number | undefined;
    page?: number | undefined;
    isRead?: "true" | "false" | undefined;
}>;
export type ListNotificationsQueryInput = z.infer<typeof listNotificationsQuerySchema>;
export declare const notificationIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export type NotificationIdParamInput = z.infer<typeof notificationIdParamSchema>;
//# sourceMappingURL=notifications.schemas.d.ts.map