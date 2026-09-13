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
    /**
     * Cursor-based pagination. Encodes the last (or first) document's _id
     * in the cursor so each page is a stable, index-anchored range scan.
     *
     * For a forward scan  (direction = 'next'): query _id > cursorId, sort ASC by _id.
     * For a backward scan (direction = 'prev'): query _id < cursorId, sort DESC by _id,
     * then reverse the result array so callers always receive items in ascending order.
     *
     * When a secondary sortField is specified the cursor encodes both the sort value
     * and the _id so ties in the sort key are broken deterministically.
     */
    async findCursorPaginated(filter = {}, options = {}, projection) {
        const limit = Math.max(1, Math.min(100, options.limit ?? 20));
        const direction = options.direction ?? 'next';
        const sortField = options.sortField ?? '_id';
        const sortDir = options.sortDir ?? 1;
        // Decode opaque cursor
        let decodedCursor = null;
        if (options.cursor) {
            try {
                decodedCursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8'));
            }
            catch {
                // Ignore malformed cursors — treat as first page
            }
        }
        const query = { ...filter };
        if (decodedCursor) {
            const cursorId = decodedCursor.id;
            const cursorValue = decodedCursor.value;
            if (sortField === '_id') {
                if (direction === 'next') {
                    query['_id'] = { $gt: cursorId };
                }
                else {
                    query['_id'] = { $lt: cursorId };
                }
            }
            else {
                // Compound sort: (sortField, _id) tie-break
                const fieldOp = direction === 'next'
                    ? (sortDir === 1 ? '$gt' : '$lt')
                    : (sortDir === 1 ? '$lt' : '$gt');
                const idOp = direction === 'next' ? '$gt' : '$lt';
                query['$or'] = [
                    { [sortField]: { [fieldOp]: cursorValue } },
                    { [sortField]: cursorValue, _id: { [idOp]: cursorId } },
                ];
            }
        }
        // Fetch limit+1 so we can detect hasNextPage / hasPrevPage
        const effectiveSortDir = direction === 'next' ? sortDir : (sortDir === 1 ? -1 : 1);
        const sortSpec = sortField === '_id'
            ? { _id: effectiveSortDir }
            : { [sortField]: effectiveSortDir, _id: effectiveSortDir };
        const rawItems = await this.model
            .find(query, projection)
            .sort(sortSpec)
            .limit(limit + 1)
            .exec();
        const hasMore = rawItems.length > limit;
        const pageItems = hasMore ? rawItems.slice(0, limit) : rawItems;
        // For backward pagination reverse so caller always gets ascending order
        if (direction === 'prev') {
            pageItems.reverse();
        }
        const encodeCursor = (doc) => {
            const raw = doc;
            const payload = { id: raw._id.toString() };
            if (sortField !== '_id') {
                payload.value = raw[sortField];
            }
            return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
        };
        const nextCursor = (direction === 'next' && hasMore) || (direction === 'prev' && decodedCursor !== null)
            ? pageItems.length > 0 ? encodeCursor(pageItems[pageItems.length - 1]) : null
            : null;
        const prevCursor = (direction === 'prev' && hasMore) || (direction === 'next' && decodedCursor !== null)
            ? pageItems.length > 0 ? encodeCursor(pageItems[0]) : null
            : null;
        return {
            items: pageItems,
            nextCursor,
            prevCursor,
            hasNextPage: direction === 'next' ? hasMore : decodedCursor !== null,
            hasPrevPage: direction === 'prev' ? hasMore : decodedCursor !== null,
            limit,
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