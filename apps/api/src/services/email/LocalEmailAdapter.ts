/**
 * LocalEmailAdapter — development / CI adapter.
 *
 * Writes every outgoing email to the structured logger instead of sending it
 * to a real SMTP server.  This makes it safe to run locally and in CI without
 * requiring any AWS credentials or network access.
 */
import { logger } from '../../core/logger';
import type { IEmailAdapter, SendEmailInput, SendEmailResult } from './IEmailAdapter';

export class LocalEmailAdapter implements IEmailAdapter {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const messageId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    logger.info(
      {
        adapter: 'local',
        messageId,
        to: input.to,
        from: input.from,
        subject: input.subject,
        idempotencyKey: input.idempotencyKey,
        // Log first 500 chars of the text body for readability
        textPreview: input.text.slice(0, 500),
      },
      '📧 [LOCAL] Email would be sent (no real delivery)',
    );
    return { messageId };
  }
}
