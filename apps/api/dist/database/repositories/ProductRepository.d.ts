import type { ProductCategory, ProductCondition } from '@airbus-tools/shared';
import { ProductStatus } from '@airbus-tools/shared';
import { type IProductDocument } from '../models/Product';
import { BaseRepository, type PaginatedResult, type PaginationOptions, type CursorPaginationOptions, type CursorPaginatedResult } from './BaseRepository';
export interface ProductCatalogFilter {
    category?: ProductCategory;
    condition?: ProductCondition;
    status?: ProductStatus;
    minPrice?: number;
    maxPrice?: number;
    sellerId?: string;
    partNumber?: string;
    tags?: string[];
    certifications?: string[];
    searchTerm?: string;
}
export declare class ProductRepository extends BaseRepository<IProductDocument> {
    constructor();
    findByPartNumber(partNumber: string): Promise<IProductDocument[]>;
    findByOemPartNumber(oemPartNumber: string): Promise<IProductDocument[]>;
    findBySeller(sellerId: string, status?: ProductStatus, options?: PaginationOptions): Promise<PaginatedResult<IProductDocument>>;
    private buildCatalogQuery;
    searchCatalog(filter: ProductCatalogFilter, options?: PaginationOptions): Promise<PaginatedResult<IProductDocument>>;
    searchCatalogCursor(filter: ProductCatalogFilter, options?: CursorPaginationOptions): Promise<CursorPaginatedResult<IProductDocument>>;
    updateInventory(id: string, quantityChange: number): Promise<IProductDocument | null>;
    updateStatus(id: string, status: ProductStatus): Promise<IProductDocument | null>;
}
export declare const productRepository: ProductRepository;
//# sourceMappingURL=ProductRepository.d.ts.map