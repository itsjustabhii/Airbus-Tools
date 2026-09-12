"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
class BaseRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    async findById(id, projection) {
        return this.model.findById(id, projection).exec();
    }
    async findOne(filter, projection) {
        return this.model.findOne(filter, projection).exec();
    }
    async find(filter = {}, projection, options) {
        return this.model.find(filter, projection, options).exec();
    }
    async findPaginated(filter = {}, options = {}, projection) {
        const page = Math.max(1, options.page ?? 1);
        const limit = Math.max(1, Math.min(100, options.limit ?? 20));
        const skip = (page - 1) * limit;
        const sort = options.sort ?? { createdAt: -1 };
        const [items, total] = await Promise.all([
            this.model.find(filter, projection).sort(sort).skip(skip).limit(limit).exec(),
            this.model.countDocuments(filter).exec(),
        ]);
        const totalPages = Math.ceil(total / limit) || 1;
        return {
            items,
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        };
    }
    async create(data) {
        return this.model.create(data);
    }
    async createMany(data) {
        const created = await this.model.insertMany(data);
        return created;
    }
    async updateById(id, update, options = { new: true }) {
        return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true, ...options }).exec();
    }
    async updateOne(filter, update, options = { new: true }) {
        return this.model.findOneAndUpdate(filter, update, { new: true, runValidators: true, ...options }).exec();
    }
    async deleteById(id) {
        return this.model.findByIdAndDelete(id).exec();
    }
    async deleteMany(filter) {
        const result = await this.model.deleteMany(filter).exec();
        return { deletedCount: result.deletedCount || 0 };
    }
    async count(filter = {}) {
        return this.model.countDocuments(filter).exec();
    }
    async exists(filter) {
        const doc = await this.model.exists(filter).exec();
        return doc !== null;
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=BaseRepository.js.map