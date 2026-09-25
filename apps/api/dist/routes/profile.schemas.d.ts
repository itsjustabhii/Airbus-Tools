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
    profilePicture: z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>;
    avatarUrl: z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>;
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
    /**
     * File size is required — it is embedded in the PutObject presigned URL as
     * ContentLength, ensuring the caller cannot upload beyond the declared size.
     * Omitting this would allow arbitrarily large S3 uploads that bypass the 5MB limit.
     */
    fileSize: z.ZodNumber;
    fileName: z.ZodOptional<z.ZodString>;
    prefix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fileSize: number;
    contentType: string;
    prefix?: string | undefined;
    fileName?: string | undefined;
}, {
    fileSize: number;
    contentType: string;
    prefix?: string | undefined;
    fileName?: string | undefined;
}>;
export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
//# sourceMappingURL=profile.schemas.d.ts.map