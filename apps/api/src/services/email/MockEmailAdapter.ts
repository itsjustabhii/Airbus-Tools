/**
 * MockEmailAdapter — unit / integration test adapter.
 *
 * Captures every outgoing send() call in memory.  Tests can inspect
 * `mockAdapter.sent` to assert on subjects, recipients, and body content
 * without any real network traffic.
 */
import type { IEmailAdapter, SendEmailInput, SendEmailResult } from './IEmailAdapter';

export class MockEmailAdapter implements IEmailAdapter {
  /** All captured send calls in the order they were made. */
  readonly sent: Array<SendEmailInput & { messageId: string }> = [];

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const messageId = `mock-${this.sent.length + 1}`;
    this.sent.push({ ...input, messageId });
    return { messageId };
  }

  /** Clear captured emails between tests. */
  reset(): void {
    this.sent.length = 0;
  }
}
