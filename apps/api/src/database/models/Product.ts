import { ProductCategory, ProductCondition, ProductStatus, type ProductDimensions } from '@airbus-tools/shared';
import { Schema, model, type Document, type Types } from 'mongoose';

export interface IProductDocument extends Document {
  sellerId: Types.ObjectId;
  title: string;
  partNumber: string;
  oemPartNumber?: string;
  description: string;
  category: ProductCategory;
  condition: ProductCondition;
  status: ProductStatus;
  price: number;
  currency: string;
  quantityAvailable: number;
  minimumOrderQuantity: number;
  certifications: string[];
  tags: string[];
  dimensions?: ProductDimensions;
  weightKg?: number;
  mediaUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductDimensionsSchema = new Schema<ProductDimensions>(
  {
    length: { type: Number, required: true, min: [0, 'Length cannot be negative'] },
    width: { type: Number, required: true, min: [0, 'Width cannot be negative'] },
    height: { type: Number, required: true, min: [0, 'Height cannot be negative'] },
    unit: {
      type: String,
      enum: ['mm', 'cm', 'm', 'in', 'ft'],
      default: 'mm',
      required: true,
    },
  },
  { _id: false },
);

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
export const ProductSchema = new Schema<IProductDocument>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
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
      enum: Object.values(ProductCategory),
      required: [true, 'Product category is required'],
    },
    condition: {
      type: String,
      enum: Object.values(ProductCondition),
      required: [true, 'Product condition is required'],
      default: ProductCondition.NEW,
    },
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      required: true,
      default: ProductStatus.DRAFT,
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
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const result = ret as Record<string, unknown>;
        result.id = (result._id as { toString(): string }).toString();
        if (result.sellerId) {
          result.sellerId = (result.sellerId as { toString(): string }).toString();
        }
        delete result._id;
        delete result.__v;
        return result;
      },
    },
  },
);

ProductSchema.index({ partNumber: 1 });
ProductSchema.index({ oemPartNumber: 1 }, { sparse: true });
ProductSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
ProductSchema.index({ category: 1, status: 1, price: 1 });
ProductSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const ProductModel = model<IProductDocument>('Product', ProductSchema);
