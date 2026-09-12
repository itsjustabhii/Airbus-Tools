"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductModel = exports.ProductSchema = void 0;
const mongoose_1 = require("mongoose");
const shared_1 = require("@airbus-tools/shared");
const ProductDimensionsSchema = new mongoose_1.Schema({
    length: { type: Number, required: true, min: [0, 'Length cannot be negative'] },
    width: { type: Number, required: true, min: [0, 'Width cannot be negative'] },
    height: { type: Number, required: true, min: [0, 'Height cannot be negative'] },
    unit: {
        type: String,
        enum: ['mm', 'cm', 'm', 'in', 'ft'],
        default: 'mm',
        required: true,
    },
}, { _id: false });
/**
 * Product Schema definition
 *
 * Index Rationale:
 * 1. { partNumber: 1 }
 *    - Query Pattern: Direct aerospace catalogue search by exact part number (P/N).
 *    - Rationale: High selectivity, primary lookup field for aerospace engineers and buyers.
 * 2. { oemPartNumber: 1 } (Sparse)
 *    - Query Pattern: Secondary cross-referencing against original manufacturer part numbers.
 *    - Rationale: High selectivity when present; sparse to save index memory.
 * 3. { sellerId: 1, status: 1, createdAt: -1 } (Compound)
 *    - Query Pattern: Seller dashboard displaying active/draft listings ordered by most recently created.
 *    - Rationale: Satisfies prefix equality match (seller + status) and sort range simultaneously without in-memory sort.
 * 4. { category: 1, status: 1, price: 1 } (Compound)
 *    - Query Pattern: Marketplace browsing by taxonomy category filtered to ACTIVE products and sorted by price.
 *    - Rationale: Multi-attribute filtering with index-supported sorting.
 * 5. { title: 'text', description: 'text', tags: 'text' } (Text Search)
 *    - Query Pattern: Free-text search across catalog title, description, and keywords.
 *    - Rationale: Full-text indexing for natural keyword search with relevance scoring.
 */
exports.ProductSchema = new mongoose_1.Schema({
    sellerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Seller ID is required'],
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    partNumber: {
        type: String,
        required: [true, 'Part number is required'],
        trim: true,
        uppercase: true,
        maxlength: [100, 'Part number cannot exceed 100 characters'],
    },
    oemPartNumber: {
        type: String,
        trim: true,
        uppercase: true,
        default: null,
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    category: {
        type: String,
        enum: Object.values(shared_1.ProductCategory),
        required: [true, 'Product category is required'],
    },
    condition: {
        type: String,
        enum: Object.values(shared_1.ProductCondition),
        required: [true, 'Product condition is required'],
        default: shared_1.ProductCondition.NEW,
    },
    status: {
        type: String,
        enum: Object.values(shared_1.ProductStatus),
        required: true,
        default: shared_1.ProductStatus.DRAFT,
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative'],
    },
    currency: {
        type: String,
        required: [true, 'Currency is required'],
        uppercase: true,
        trim: true,
        default: 'USD',
        length: 3,
    },
    quantityAvailable: {
        type: Number,
        required: [true, 'Available quantity is required'],
        min: [0, 'Quantity cannot be negative'],
        default: 0,
    },
    minimumOrderQuantity: {
        type: Number,
        required: true,
        min: [1, 'Minimum order quantity must be at least 1'],
        default: 1,
    },
    certifications: {
        type: [String],
        default: [],
    },
    tags: {
        type: [String],
        default: [],
    },
    dimensions: {
        type: ProductDimensionsSchema,
        default: null,
    },
    weightKg: {
        type: Number,
        min: [0, 'Weight cannot be negative'],
        default: null,
    },
    mediaUrls: {
        type: [String],
        default: [],
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (_doc, ret) => {
            ret.id = ret._id.toString();
            ret.sellerId = ret.sellerId?.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        },
    },
});
exports.ProductSchema.index({ partNumber: 1 });
exports.ProductSchema.index({ oemPartNumber: 1 }, { sparse: true });
exports.ProductSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
exports.ProductSchema.index({ category: 1, status: 1, price: 1 });
exports.ProductSchema.index({ title: 'text', description: 'text', tags: 'text' });
exports.ProductModel = (0, mongoose_1.model)('Product', exports.ProductSchema);
//# sourceMappingURL=Product.js.map