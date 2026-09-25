import { UserRole } from '@airbus-tools/shared';
import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    role: z.ZodEnum<[UserRole.AIRLINE, UserRole.SUPPLIER]>;
    phoneNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole.AIRLINE | UserRole.SUPPLIER;
    phoneNumber?: string | undefined;
}, {
    password: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole.AIRLINE | UserRole.SUPPLIER;
    phoneNumber?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
}, {
    password: string;
    email: string;
}>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
//# sourceMappingURL=schemas.d.ts.map