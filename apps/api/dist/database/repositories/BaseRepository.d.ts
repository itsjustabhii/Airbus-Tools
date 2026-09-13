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
export type CursorDirection = 'next' | 'prev';
export interface CursorPaginationOptions {
    /** Opaque cursor produced by a previous response */
    cursor?: string;
    direction?: CursorDirection;
    limit?: number;
    /** Field to sort on; only '_id' or indexed date fields are safe */
    sortField?: string;
    sortDir?: 1 | -1;
}
export interface CursorPaginatedResult<T> {
    items: T[];
    nextCursor: string | null;
    prevCursor: string | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
}
export interface IBaseRepository<T extends Document> {
    findById(id: string, projection?: ProjectionType<T>): Promise<T | null>;
    findOne(filter: FilterQuery<T>, projection?: ProjectionType<T>): Promise<T | null>;
    find(filter?: FilterQuery<T>, projection?: ProjectionType<T>, options?: QueryOptions<T>): Promise<T[]>;
    findPaginated(filter?: FilterQuery<T>, options?: PaginationOptions, projection?: ProjectionType<T>): Promise<PaginatedResult<T>>;
    findCursorPaginated(filter?: FilterQuery<T>, options?: CursorPaginationOptions, projection?: ProjectionType<T>): Promise<CursorPaginatedResult<T>>;
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
    findCursorPaginated(filter?: FilterQuery<T>, options?: CursorPaginationOptions, projection?: ProjectionType<T>): Promise<CursorPaginatedResult<T>>;
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