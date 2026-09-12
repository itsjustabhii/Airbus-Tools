import type { ProductCategory, ProductCondition} from '@airbus-tools/shared';
import { ProductStatus } from '@airbus-tools/shared';
import type { FilterQuery } from 'mongoose';

import { ProductModel, type IProductDocument } from '../models/Product';

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

export class ProductRepository extends BaseRepository<IProductDocument> {
  constructor() {
    super(ProductModel);
  }

  public async findByPartNumber(partNumber: string): Promise<IProductDocument[]> {
    return this.find({ partNumber: partNumber.toUpperCase().trim() });
  }

  public async findByOemPartNumber(oemPartNumber: string): Promise<IProductDocument[]> {
    return this.find({ oemPartNumber: oemPartNumber.toUpperCase().trim() });
  }

  public async findBySeller(
    sellerId: string,
    status?: ProductStatus,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IProductDocument>> {
    const filter: FilterQuery<IProductDocument> = { sellerId };
    if (status) {
      filter.status = status;
    }
    return this.findPaginated(filter, options);
  }

  private buildCatalogQuery(filter: ProductCatalogFilter): FilterQuery<IProductDocument> {
    const query: FilterQuery<IProductDocument> = {};

    query.status = filter.status ?? ProductStatus.ACTIVE;

    if (filter.category) query.category = filter.category;
    if (filter.condition) query.condition = filter.condition;
    if (filter.sellerId) query.sellerId = filter.sellerId;
    if (filter.partNumber) query.partNumber = filter.partNumber.toUpperCase().trim();

    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      const priceFilter: { $gte?: number; $lte?: number } = {};
      if (filter.minPrice !== undefined) priceFilter.$gte = filter.minPrice;
      if (filter.maxPrice !== undefined) priceFilter.$lte = filter.maxPrice;
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

  public async searchCatalog(
    filter: ProductCatalogFilter,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<IProductDocument>> {
    return this.findPaginated(this.buildCatalogQuery(filter), options);
  }

  public async searchCatalogCursor(
    filter: ProductCatalogFilter,
    options?: CursorPaginationOptions,
  ): Promise<CursorPaginatedResult<IProductDocument>> {
    return this.findCursorPaginated(this.buildCatalogQuery(filter), options);
  }

  public async updateInventory(id: string, quantityChange: number): Promise<IProductDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, quantityAvailable: { $gte: -quantityChange } },
        { $inc: { quantityAvailable: quantityChange } },
        { new: true, runValidators: true },
      )
      .exec();
  }

  public async updateStatus(id: string, status: ProductStatus): Promise<IProductDocument | null> {
    return this.updateById(id, { status });
  }
}

export const productRepository = new ProductRepository();
