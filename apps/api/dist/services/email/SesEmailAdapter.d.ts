/**
 * Amazon SES email adapter.
 *
 * Uses @aws-sdk/client-ses v3.  The SESClient is a singleton — credentials
 * are resolved from the environment (IAM role in production, explicit keys in
 * dev/staging via AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
 *
 * The adapter passes the caller-supplied `idempotencyKey` as the SES
 * `ClientToken` field to prevent double-delivery on worker retries.
 */
import { SESClient } from '@aws-sdk/client-ses';
import type { IEmailAdapter, SendEmailInput, SendEmailResult } from './IEmailAdapter';
export declare function getSesClient(): SESClient;
export declare class SesEmailAdapter implements IEmailAdapter {
    send(input: SendEmailInput): Promise<SendEmailResult>;
}
//# sourceMappingURL=SesEmailAdapter.d.ts.map