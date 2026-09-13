"use strict";
/**
 * IEmailAdapter — contract that every email backend must satisfy.
 *
 * Concrete implementations:
 *  - SesEmailAdapter   → production (AWS SES)
 *  - LocalEmailAdapter → development / test (logs only, no real delivery)
 *  - MockEmailAdapter  → unit / integration tests (in-memory capture)
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=IEmailAdapter.js.map