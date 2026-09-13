"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRepository = exports.ProductRepository = void 0;
const shared_1 = require("@airbus-tools/shared");
const Product_1 = require("../models/Product");
const BaseRepository_1 = require("./BaseRepository");
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
    buildCatalogQuery(filter) {
        const query = {};
        query.status = filter.status ?? shared_1.ProductStatus.ACTIVE;
        if (filter.category)
            query.category = filter.category;
        if (filter.condition)
            query.condition = filter.condition;
        if (filter.sellerId)
            query.sellerId = filter.sellerId;
        if (filter.partNumber)
            query.partNumber = filter.partNumber.toUpperCase().trim();
        if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
            const priceFilter = {};
            if (filter.minPrice !== undefined)
                priceFilter.$gte = filter.minPrice;
            if (filter.maxPrice !== undefined)
                priceFilter.$lte = filter.maxPrice;
            query.price = priceFilter;
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
        return query;
    }
    async searchCatalog(filter, options) {
        return this.findPaginated(this.buildCatalogQuery(filter), options);
    }
    async searchCatalogCursor(filter, options) {
        return this.findCursorPaginated(this.buildCatalogQuery(filter), options);
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