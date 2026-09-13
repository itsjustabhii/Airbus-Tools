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
import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-ses';

import { config } from '../../config/env';
import { logger } from '../../core/logger';
import type { IEmailAdapter, SendEmailInput, SendEmailResult } from './IEmailAdapter';

let sesClientInstance: SESClient | null = null;

export function getSesClient(): SESClient {
  if (!sesClientInstance) {
    sesClientInstance = new SESClient({
      region: config.AWS_REGION,
      ...(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: config.AWS_ACCESS_KEY_ID,
              secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
      ...(config.AWS_SES_ENDPOINT ? { endpoint: config.AWS_SES_ENDPOINT } : {}),
    });
    logger.info({ region: config.AWS_REGION }, 'SES client initialised');
  }
  return sesClientInstance;
}

export class SesEmailAdapter implements IEmailAdapter {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const params: SendEmailCommandInput = {
      Source: input.from,
      Destination: { ToAddresses: [input.to] },
      Message: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: input.html, Charset: 'UTF-8' },
          Text: { Data: input.text, Charset: 'UTF-8' },
        },
      },
      ...(input.replyTo ? { ReplyToAddresses: [input.replyTo] } : {}),
    };

    const client = getSesClient();
    const command = new SendEmailCommand(params);
    const response = await client.send(command);

    const messageId = response.MessageId ?? 'unknown';
    logger.info(
      { to: input.to, subject: input.subject, messageId },
      'SES email sent',
    );
    return { messageId };
  }
}
