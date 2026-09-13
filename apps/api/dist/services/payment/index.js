"use strict";
/**
 * Payment service index — exports the singleton PaymentService instance.
 *
 * The active provider is selected by PAYMENT_PROVIDER env var:
 *   - 'mock'  → MockPaymentProvider (default for test / local)
 *
 * Adding a new provider (e.g. Stripe):
 *   1. Implement IPaymentProvider in StripePaymentProvider.ts
 *   2. Add 'stripe' to the switch below
 *   3. Set PAYMENT_PROVIDER=stripe in production env
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_TERMINAL_STATUSES = exports.isPaymentTerminal = exports.assertPaymentTransition = exports.MockPaymentProvider = exports.PaymentService = exports.paymentService = void 0;
const env_1 = require("../../config/env");
const MockPaymentProvider_1 = require("./MockPaymentProvider");
const paymentService_1 = require("./paymentService");
function buildProvider() {
    const providerName = env_1.config['PAYMENT_PROVIDER'] ?? 'mock';
    switch (providerName) {
        case 'mock':
        default:
            return new MockPaymentProvider_1.MockPaymentProvider();
    }
}
exports.paymentService = new paymentService_1.PaymentService(buildProvider());
var paymentService_2 = require("./paymentService");
Object.defineProperty(exports, "PaymentService", { enumerable: true, get: function () { return paymentService_2.PaymentService; } });
var MockPaymentProvider_2 = require("./MockPaymentProvider");
Object.defineProperty(exports, "MockPaymentProvider", { enumerable: true, get: function () { return MockPaymentProvider_2.MockPaymentProvider; } });
var paymentStateMachine_1 = require("./paymentStateMachine");
Object.defineProperty(exports, "assertPaymentTransition", { enumerable: true, get: function () { return paymentStateMachine_1.assertPaymentTransition; } });
Object.defineProperty(exports, "isPaymentTerminal", { enumerable: true, get: function () { return paymentStateMachine_1.isPaymentTerminal; } });
Object.defineProperty(exports, "PAYMENT_TERMINAL_STATUSES", { enumerable: true, get: function () { return paymentStateMachine_1.PAYMENT_TERMINAL_STATUSES; } });
//# sourceMappingURL=index.js.map