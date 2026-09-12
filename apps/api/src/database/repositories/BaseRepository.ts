import type { Model, Document, FilterQuery, UpdateQuery, QueryOptions, ProjectionType } from 'mongoose';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface IBaseRepository<T extends Document> {
  findById(id: string, projection?: ProjectionType<T>): Promise<T | null>;
  findOne(filter: FilterQuery<T>, projection?: ProjectionType<T>): Promise<T | null>;
  find(filter?: FilterQuery<T>, projection?: ProjectionType<T>, options?: QueryOptions<T>): Promise<T[]>;
  findPaginated(filter?: FilterQuery<T>, options?: PaginationOptions, projection?: ProjectionType<T>): Promise<PaginatedResult<T>>;
  create(data: Partial<T>): Promise<T>;
  createMany(data: Partial<T>[]): Promise<T[]>;
  updateById(id: string, update: UpdateQuery<T>, options?: QueryOptions<T>): Promise<T | null>;
  updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>, options?: QueryOptions<T>): Promise<T | null>;
  deleteById(id: string): Promise<T | null>;
  deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }>;
  count(filter?: FilterQuery<T>): Promise<number>;
  exists(filter: FilterQuery<T>): Promise<boolean>;
}

export abstract class BaseRepository<T extends Document> implements IBaseRepository<T> {
  protected readonly model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  public async findById(id: string, projection?: ProjectionType<T>): Promise<T | null> {
    return this.model.findById(id, projection).exec();
  }

  public async findOne(filter: FilterQuery<T>, projection?: ProjectionType<T>): Promise<T | null> {
    return this.model.findOne(filter, projection).exec();
  }

  public async find(
    filter: FilterQuery<T> = {},
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>,
  ): Promise<T[]> {
    return this.model.find(filter, projection, options).exec();
  }

  public async findPaginated(
    filter: FilterQuery<T> = {},
    options: PaginationOptions = {},
    projection?: ProjectionType<T>,
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const skip = (page - 1) * limit;
    const sort = options.sort ?? { createdAt: -1 as const };

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

  public async create(data: Partial<T>): Promise<T> {
    return this.model.create(data);
  }

  public async createMany(data: Partial<T>[]): Promise<T[]> {
    const created = await this.model.insertMany(data);
    return created as unknown as T[];
  }

  public async updateById(
    id: string,
    update: UpdateQuery<T>,
    options: QueryOptions<T> = { new: true },
  ): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true, ...options }).exec();
  }

  public async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options: QueryOptions<T> = { new: true },
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(filter, update, { new: true, runValidators: true, ...options }).exec();
  }

  public async deleteById(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  public async deleteMany(filter: FilterQuery<T>): Promise<{ deletedCount: number }> {
    const result = await this.model.deleteMany(filter).exec();
    return { deletedCount: result.deletedCount || 0 };
  }

  public async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  public async exists(filter: FilterQuery<T>): Promise<boolean> {
    const doc = await this.model.exists(filter).exec();
    return doc !== null;
  }
}
