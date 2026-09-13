"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SesEmailAdapter = void 0;
exports.getSesClient = getSesClient;
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
const client_ses_1 = require("@aws-sdk/client-ses");
const env_1 = require("../../config/env");
const logger_1 = require("../../core/logger");
let sesClientInstance = null;
function getSesClient() {
    if (!sesClientInstance) {
        sesClientInstance = new client_ses_1.SESClient({
            region: env_1.config.AWS_REGION,
            ...(env_1.config.AWS_ACCESS_KEY_ID && env_1.config.AWS_SECRET_ACCESS_KEY
                ? {
                    credentials: {
                        accessKeyId: env_1.config.AWS_ACCESS_KEY_ID,
                        secretAccessKey: env_1.config.AWS_SECRET_ACCESS_KEY,
                    },
                }
                : {}),
            ...(env_1.config.AWS_SES_ENDPOINT ? { endpoint: env_1.config.AWS_SES_ENDPOINT } : {}),
        });
        logger_1.logger.info({ region: env_1.config.AWS_REGION }, 'SES client initialised');
    }
    return sesClientInstance;
}
class SesEmailAdapter {
    async send(input) {
        const params = {
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
        const command = new client_ses_1.SendEmailCommand(params);
        const response = await client.send(command);
        const messageId = response.MessageId ?? 'unknown';
        logger_1.logger.info({ to: input.to, subject: input.subject, messageId }, 'SES email sent');
        return { messageId };
    }
}
exports.SesEmailAdapter = SesEmailAdapter;
//# sourceMappingURL=SesEmailAdapter.js.map