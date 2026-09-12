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
    deleteMany(filter: FilterQuery<T>): Promise<{
        deletedCount: number;
    }>;
    count(filter?: FilterQuery<T>): Promise<number>;
    exists(filter: FilterQuery<T>): Promise<boolean>;
}
export declare abstract class BaseRepository<T extends Document> implements IBaseRepository<T> {
    protected readonly model: Model<T>;
    constructor(model: Model<T>);
    findById(id: string, projection?: ProjectionType<T>): Promise<T | null>;
    findOne(filter: FilterQuery<T>, projection?: ProjectionType<T>): Promise<T | null>;
    find(filter?: FilterQuery<T>, projection?: ProjectionType<T>, options?: QueryOptions<T>): Promise<T[]>;
    findPaginated(filter?: FilterQuery<T>, options?: PaginationOptions, projection?: ProjectionType<T>): Promise<PaginatedResult<T>>;
    create(data: Partial<T>): Promise<T>;
    createMany(data: Partial<T>[]): Promise<T[]>;
    updateById(id: string, update: UpdateQuery<T>, options?: QueryOptions<T>): Promise<T | null>;
    updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>, options?: QueryOptions<T>): Promise<T | null>;
    deleteById(id: string): Promise<T | null>;
    deleteMany(filter: FilterQuery<T>): Promise<{
        deletedCount: number;
    }>;
    count(filter?: FilterQuery<T>): Promise<number>;
    exists(filter: FilterQuery<T>): Promise<boolean>;
}
//# sourceMappingURL=BaseRepository.d.ts.map