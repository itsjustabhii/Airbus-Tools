"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRepository = exports.ProductRepository = void 0;
const Product_1 = require("../models/Product");
const BaseRepository_1 = require("./BaseRepository");
const shared_1 = require("@airbus-tools/shared");
class ProductRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super(Product_1.ProductModel);
    }
    async findByPartNumber(partNumber) {
        return this.find({ partNumber: partNumber.toUpperCase().trim() });
    }
    async findByOemPartNumber(oemPartNumber) {
        return this.find({ oemPartNumber: oemPartNumber.toUpperCase().trim() });
    }
    async findBySeller(sellerId, status, options) {
        const filter = { sellerId };
        if (status) {
            filter.status = status;
        }
        return this.findPaginated(filter, options);
    }
    async searchCatalog(filter, options) {
        const query = {};
        if (filter.status) {
            query.status = filter.status;
        }
        else {
            query.status = shared_1.ProductStatus.ACTIVE;
        }
        if (filter.category) {
            query.category = filter.category;
        }
        if (filter.condition) {
            query.condition = filter.condition;
        }
        if (filter.sellerId) {
            query.sellerId = filter.sellerId;
        }
        if (filter.partNumber) {
            query.partNumber = filter.partNumber.toUpperCase().trim();
        }
        if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
            query.price = {};
            if (filter.minPrice !== undefined) {
                query.price.$gte = filter.minPrice;
            }
            if (filter.maxPrice !== undefined) {
                query.price.$lte = filter.maxPrice;
            }
        }
        if (filter.tags && filter.tags.length > 0) {
            query.tags = { $in: filter.tags };
        }
        if (filter.certifications && filter.certifications.length > 0) {
            query.certifications = { $all: filter.certifications };
        }
        if (filter.searchTerm) {
            query.$text = { $search: filter.searchTerm };
        }
        return this.findPaginated(query, options);
    }
    async updateInventory(id, quantityChange) {
        return this.model
            .findOneAndUpdate({ _id: id, quantityAvailable: { $gte: -quantityChange } }, { $inc: { quantityAvailable: quantityChange } }, { new: true, runValidators: true })
            .exec();
    }
    async updateStatus(id, status) {
        return this.updateById(id, { status });
    }
}
exports.ProductRepository = ProductRepository;
exports.productRepository = new ProductRepository();
//# sourceMappingURL=ProductRepository.js.map