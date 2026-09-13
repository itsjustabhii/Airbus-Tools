"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRepository = exports.PaymentRepository = void 0;
const shared_1 = require("@airbus-tools/shared");
const Payment_1 = require("../models/Payment");
const BaseRepository_1 = require("./BaseRepository");
class PaymentRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super(Payment_1.PaymentModel);
    }
    async findByPaymentNumber(paymentNumber) {
        return this.findOne({ paymentNumber: paymentNumber.toUpperCase().trim() });
    }
    async findByProviderPaymentId(providerPaymentId) {
        return this.findOne({ providerPaymentId });
    }
    async findByIdempotencyKey(idempotencyKey) {
        return this.findOne({ idempotencyKey });
    }
    async findByOrderId(orderId) {
        return this.findOne({ orderId });
    }
    async findByOrder(orderId) {
        return this.find({ orderId });
    }
    async findByPayer(payerId, options) {
        return this.findPaginated({ payerId }, options);
    }
    async findByPayee(payeeId, options) {
        return this.findPaginated({ payeeId }, options);
    }
    async updateStatus(id, status, details) {
        const update = { status };
        if (details) {
            Object.assign(update, details);
        }
        return this.updateById(id, update);
    }
    async findPendingPayments(options) {
        const filter = { status: shared_1.PaymentStatus.PENDING };
        return this.findPaginated(filter, { sort: { createdAt: 1 }, ...options });
    }
}
exports.PaymentRepository = PaymentRepository;
exports.paymentRepository = new PaymentRepository();
//# sourceMappingURL=PaymentRepository.js.map