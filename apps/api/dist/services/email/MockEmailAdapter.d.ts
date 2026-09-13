/**
 * MockEmailAdapter — unit / integration test adapter.
 *
 * Captures every outgoing send() call in memory.  Tests can inspect
 * `mockAdapter.sent` to assert on subjects, recipients, and body content
 * without any real network traffic.
 */
import type { IEmailAdapter, SendEmailInput, SendEmailResult } from './IEmailAdapter';
export declare class MockEmailAdapter implements IEmailAdapter {
    /** All captured send calls in the order they were made. */
    readonly sent: Array<SendEmailInput & {
        messageId: string;
    }>;
    send(input: SendEmailInput): Promise<SendEmailResult>;
    /** Clear captured emails between tests. */
    reset(): void;
}
//# sourceMappingURL=MockEmailAdapter.d.ts.map