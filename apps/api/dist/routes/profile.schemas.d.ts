import { z } from 'zod';
/**
 * Schema for updating user profile.
 * Users may modify: name, bio, profile picture (avatarUrl / profilePicture).
 * Users CANNOT modify: email, company, role, status, id, password, organizationId.
 * Strips unknown fields and explicitly prevents attempts to alter protected fields.
 */
export declare const updateProfileSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    profilePicture: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    avatarUrl: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
}, "strict", z.ZodTypeAny, {
    name?: string | undefined;
    bio?: string | undefined;
    avatarUrl?: string | undefined;
    profilePicture?: string | undefined;
}, {
    name?: string | undefined;
    bio?: string | undefined;
    avatarUrl?: string | undefined;
    profilePicture?: string | undefined;
}>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
/**
 * Schema for generating a presigned S3 upload URL.
 */
export declare const presignedUrlSchema: z.ZodObject<{
    contentType: z.ZodEffects<z.ZodString, string, string>;
    fileSize: z.ZodOptional<z.ZodNumber>;
    fileName: z.ZodOptional<z.ZodString>;
    prefix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    contentType: string;
    prefix?: string | undefined;
    fileName?: string | undefined;
    fileSize?: number | undefined;
}, {
    contentType: string;
    prefix?: string | undefined;
    fileName?: string | undefined;
    fileSize?: number | undefined;
}>;
export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
//# sourceMappingURL=profile.schemas.d.ts.map