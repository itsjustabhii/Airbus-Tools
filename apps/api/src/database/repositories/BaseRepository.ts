import type { Model, Document, FilterQuery, UpdateQuery, QueryOptions, ProjectionType, SortOrder } from 'mongoose';
import type { Types } from 'mongoose';

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
  public async findCursorPaginated(
    filter: FilterQuery<T> = {},
    options: CursorPaginationOptions = {},
    projection?: ProjectionType<T>,
  ): Promise<CursorPaginatedResult<T>> {
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const direction = options.direction ?? 'next';
    const sortField = options.sortField ?? '_id';
    const sortDir: 1 | -1 = options.sortDir ?? 1;

    // Decode opaque cursor
    let decodedCursor: { id: string; value?: unknown } | null = null;
    if (options.cursor) {
      try {
        decodedCursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8')) as { id: string; value?: unknown };
      } catch {
        // Ignore malformed cursors — treat as first page
      }
    }

    const query: FilterQuery<T> = { ...filter };

    if (decodedCursor) {
      const cursorId = decodedCursor.id;
      const cursorValue = decodedCursor.value;

      if (sortField === '_id') {
        if (direction === 'next') {
          (query as Record<string, unknown>)['_id'] = { $gt: cursorId };
        } else {
          (query as Record<string, unknown>)['_id'] = { $lt: cursorId };
        }
      } else {
        // Compound sort: (sortField, _id) tie-break
        const fieldOp = direction === 'next'
          ? (sortDir === 1 ? '$gt' : '$lt')
          : (sortDir === 1 ? '$lt' : '$gt');
        const idOp = direction === 'next' ? '$gt' : '$lt';
        (query as Record<string, unknown>)['$or'] = [
          { [sortField]: { [fieldOp]: cursorValue } },
          { [sortField]: cursorValue, _id: { [idOp]: cursorId } },
        ];
      }
    }

    // Fetch limit+1 so we can detect hasNextPage / hasPrevPage
    const effectiveSortDir: SortOrder = direction === 'next' ? sortDir : (sortDir === 1 ? -1 : 1);
    const sortSpec: Record<string, SortOrder> =
      sortField === '_id'
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

    const encodeCursor = (doc: T): string => {
      const raw = doc as unknown as { _id: Types.ObjectId; [key: string]: unknown };
      const payload: { id: string; value?: unknown } = { id: raw._id.toString() };
      if (sortField !== '_id') {
        payload.value = raw[sortField];
      }
      return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    };

    const nextCursor = (direction === 'next' && hasMore) || (direction === 'prev' && decodedCursor !== null)
      ? pageItems.length > 0 ? encodeCursor(pageItems[pageItems.length - 1]!) : null
      : null;

    const prevCursor = (direction === 'prev' && hasMore) || (direction === 'next' && decodedCursor !== null)
      ? pageItems.length > 0 ? encodeCursor(pageItems[0]!) : null
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
