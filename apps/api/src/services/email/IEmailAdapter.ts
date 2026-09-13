/**
 * IEmailAdapter — contract that every email backend must satisfy.
 *
 * Concrete implementations:
 *  - SesEmailAdapter   → production (AWS SES)
 *  - LocalEmailAdapter → development / test (logs only, no real delivery)
 *  - MockEmailAdapter  → unit / integration tests (in-memory capture)
 */

export interface SendEmailInput {
  /** Recipient email address */
  to: string;
  /** Verified sender address (comes from env SES_FROM_ADDRESS) */
  from: string;
  replyTo?: string;
  subject: string;
  /** Full HTML body */
  html: string;
  /** Plain-text fallback */
  text: string;
  /**
   * Idempotency key — adapters should surface this to the upstream provider
   * when supported (SES supports a ClientToken for deduplification).
   */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  /** Provider-assigned message ID (SES: MessageId) */
  messageId: string;
}

export interface IEmailAdapter {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
