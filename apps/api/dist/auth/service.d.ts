import type { RegisterInput, LoginInput, ChangePasswordInput } from './schemas';
export declare const AUTH_COOKIE_NAME = "access_token";
export declare function registerUser(input: RegisterInput): Promise<{
    token: string;
    user: Record<string, unknown> | null;
}>;
export declare function loginUser(input: LoginInput): Promise<{
    token: string;
    user: Record<string, unknown> | null;
}>;
export declare function getMe(userId: string): Promise<Record<string, unknown> | null>;
export declare function changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
//# sourceMappingURL=service.d.ts.map