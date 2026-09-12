"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRepository = exports.OrderRepository = void 0;
const Order_1 = require("../models/Order");
const BaseRepository_1 = require("./BaseRepository");
class OrderRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super(Order_1.OrderModel);
    }
    async findByOrderNumber(orderNumber) {
        return this.findOne({ orderNumber: orderNumber.toUpperCase().trim() });
    }
    async findByBuyer(buyerId, status, options) {
        const filter = { buyerId };
        if (status) {
            filter.status = status;
        }
        return this.findPaginated(filter, options);
    }
    async findBySeller(sellerId, status, options) {
        const filter = { sellerId };
        if (status) {
            filter.status = status;
        }
        return this.findPaginated(filter, options);
    }
    async updateStatus(id, status, statusDateFields) {
        const update = { status };
        if (statusDateFields) {
            Object.assign(update, statusDateFields);
        }
        return this.updateById(id, update);
    }
    async filterOrders(filter, options) {
        const query = {};
        if (filter.buyerId) {
            query.buyerId = filter.buyerId;
        }
        if (filter.sellerId) {
            query.sellerId = filter.sellerId;
        }
        if (filter.status) {
            query.status = filter.status;
        }
        if (filter.startDate || filter.endDate) {
            query.createdAt = {};
            if (filter.startDate) {
                query.createdAt.$gte = filter.startDate;
            }
            if (filter.endDate) {
                query.createdAt.$lte = filter.endDate;
            }
        }
        return this.findPaginated(query, options);
    }
}
exports.OrderRepository = OrderRepository;
exports.orderRepository = new OrderRepository();
//# sourceMappingURL=OrderRepository.js.map