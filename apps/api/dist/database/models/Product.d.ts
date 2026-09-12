import { ProductCategory, ProductCondition, ProductStatus, type ProductDimensions } from '@airbus-tools/shared';
import { Schema, type Document, type Types } from 'mongoose';
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
export declare const ProductSchema: Schema<IProductDocument, import("mongoose").Model<IProductDocument, any, any, any, Document<unknown, any, IProductDocument, any, {}> & IProductDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, IProductDocument, Document<unknown, {}, import("mongoose").FlatRecord<IProductDocument>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<IProductDocument> & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const ProductModel: import("mongoose").Model<IProductDocument, {}, {}, {}, Document<unknown, {}, IProductDocument, {}, {}> & IProductDocument & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Product.d.ts.map