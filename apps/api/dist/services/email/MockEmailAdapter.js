"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEmailAdapter = void 0;
class MockEmailAdapter {
    /** All captured send calls in the order they were made. */
    sent = [];
    async send(input) {
        const messageId = `mock-${this.sent.length + 1}`;
        this.sent.push({ ...input, messageId });
        return { messageId };
    }
    /** Clear captured emails between tests. */
    reset() {
        this.sent.length = 0;
    }
}
exports.MockEmailAdapter = MockEmailAdapter;
//# sourceMappingURL=MockEmailAdapter.js.map