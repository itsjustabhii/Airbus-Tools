/**
 * Public API for the email service module.
 */
export type { IEmailAdapter, SendEmailInput, SendEmailResult } from './IEmailAdapter';
export { LocalEmailAdapter } from './LocalEmailAdapter';
export { SesEmailAdapter } from './SesEmailAdapter';
export { MockEmailAdapter } from './MockEmailAdapter';
export { EmailService, emailService, processedJobIds } from './EmailService';
export * from './templates';
//# sourceMappingURL=index.d.ts.map