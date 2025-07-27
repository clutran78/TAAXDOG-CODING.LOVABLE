/**
 * Base Repository Pattern
 *
 * Provides a consistent interface for database operations
 * with built-in security, validation, and error handling
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';
import {
  findManyWithPagination,
  findUniqueSecure,
  createSecure,
  updateSecure,
  softDeleteSecure,
  aggregateSecure,
  withTransaction,
  handleDatabaseError,
  QueryOptions,
  QueryResult,
  TransactionOptions,
} from '../db/query-patterns';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface IRepository<T, CreateInput, UpdateInput> {
  // Basic CRUD operations
  findById(id: string, userId?: string): Promise<T | null>;
  findMany(options: QueryOptions<T>): Promise<QueryResult<T[]>>;
  create(data: CreateInput, userId: string): Promise<T>;
  update(id: string, data: UpdateInput, userId: string): Promise<T>;
  delete(id: string, userId: string): Promise<void>;

  // Aggregation operations
  count(where?: any, userId?: string): Promise<number>;
  aggregate(options: any, userId?: string): Promise<any>;

  // Transaction support
  transaction<R>(
    operation: (tx: PrismaClient) => Promise<R>,
    options?: TransactionOptions,
  ): Promise<R>;
}

// ============================================================================
// BASE REPOSITORY IMPLEMENTATION
// ============================================================================

export abstract class BaseRepository<
  T extends { id: string; userId?: string },
  CreateInput,
  UpdateInput,
> implements IRepository<T, CreateInput, UpdateInput>
{
  protected abstract model: any;
  protected abstract modelName: string;

  constructor(protected prisma: PrismaClient = prisma) {}

  // ========================================
  // BASIC CRUD OPERATIONS
  // ========================================

  /**
   * Find a record by ID with optional user ownership validation
   */
  async findById(id: string, userId?: string): Promise<T | null> {
    try {
      const record = await findUniqueSecure<T>(this.model, id, userId, {
        include: this.getDefaultIncludes(),
        select: this.getDefaultSelect(),
      });

      return this.transformRecord(record);
    } catch (error) {
      // Return null if not found instead of throwing
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }

      await handleDatabaseError(error, {
        operation: 'findById',
        userId,
        resource: this.modelName,
      });
      throw error;
    }
  }

  /**
   * Find many records with pagination and filtering
   */
  async findMany(options: QueryOptions<T>): Promise<QueryResult<T[]>> {
    try {
      const result = await findManyWithPagination<T>(this.model, {
        ...options,
        orderBy: options.orderBy || this.getDefaultOrderBy(),
        select: options.select || this.getDefaultSelect(),
        include: options.include || this.getDefaultIncludes(),
      });

      return {
        data: result.data.map((record) => this.transformRecord(record)),
        meta: result.meta,
      };
    } catch (error) {
      await handleDatabaseError(error, {
        operation: 'findMany',
        userId: options.userId,
        resource: this.modelName,
      });
      throw error;
    }
  }

  /**
   * Create a new record with validation
   */
  async create(data: CreateInput, userId: string): Promise<T> {
    try {
      // Validate data before creation
      await this.validateCreate(data, userId);

      // Transform data if needed
      const transformedData = await this.transformCreateData(data, userId);

      // Create record with audit logging
      const record = await createSecure<T>(this.model, transformedData, userId, {
        maxRecords: this.getMaxRecordsPerUser(),
        auditLog: this.shouldAuditLog(),
        validateUniqueness: await this.getUniquenessConstraint(data),
      });

      // Perform any post-create operations
      await this.afterCreate(record, userId);

      return this.transformRecord(record);
    } catch (error) {
      await handleDatabaseError(error, {
        operation: 'create',
        userId,
        resource: this.modelName,
      });
      throw error;
    }
  }

  /**
   * Update a record with ownership validation
   */
  async update(id: string, data: UpdateInput, userId: string): Promise<T> {
    try {
      // Validate ownership and data
      await this.validateUpdate(id, data, userId);

      // Transform data if needed
      const transformedData = await this.transformUpdateData(data, userId);

      // Update record with audit logging
      const record = await updateSecure<T>(this.model, id, transformedData, userId, {
        validateOwnership: this.requiresOwnership(),
        auditLog: this.shouldAuditLog(),
      });

      // Perform any post-update operations
      await this.afterUpdate(record, userId);

      return this.transformRecord(record);
    } catch (error) {
      await handleDatabaseError(error, {
        operation: 'update',
        userId,
        resource: this.modelName,
      });
      throw error;
    }
  }

  /**
   * Soft delete a record with ownership validation
   */
  async delete(id: string, userId: string): Promise<void> {
    try {
      // Validate before deletion
      await this.validateDelete(id, userId);

      // Soft delete with audit logging
      await softDeleteSecure(this.model, id, userId, {
        validateOwnership: this.requiresOwnership(),
        auditLog: this.shouldAuditLog(),
      });

      // Perform any post-delete operations
      await this.afterDelete(id, userId);
    } catch (error) {
      await handleDatabaseError(error, {
        operation: 'delete',
        userId,
        resource: this.modelName,
      });
      throw error;
    }
  }

  // ========================================
  // AGGREGATION OPERATIONS
  // ========================================

  /**
   * Count records with optional filtering
   */
  async count(where?: any, userId?: string): Promise<number> {
    try {
      const secureWhere =
        userId && this.requiresOwnership()
          ? { ...where, userId, deletedAt: null }
          : { ...where, deletedAt: null };

      return await this.model.count({ where: secureWhere });
    } catch (error) {
      await handleDatabaseError(error, {
        operation: 'count',
        userId,
        resource: this.modelName,
      });
      throw error;
    }
  }

  /**
   * Perform aggregation operations
   */
  async aggregate(options: any, userId?: string): Promise<any> {
    try {
      if (!userId) {
        throw new Error('User ID required for aggregation');
      }

      return await aggregateSecure(this.model, userId, options);
    } catch (error) {
      await handleDatabaseError(error, {
        operation: 'aggregate',
        userId,
        resource: this.modelName,
      });
      throw error;
    }
  }

  // ========================================
  // TRANSACTION SUPPORT
  // ========================================

  /**
   * Execute operations in a transaction
   */
  async transaction<R>(
    operation: (tx: PrismaClient) => Promise<R>,
    options?: TransactionOptions,
  ): Promise<R> {
    return withTransaction(operation, options);
  }

  // ========================================
  // HOOKS AND CUSTOMIZATION POINTS
  // ========================================

  /**
   * Hook methods that can be overridden by subclasses
   */

  protected async validateCreate(data: CreateInput, userId: string): Promise<void> {
    // Override in subclass for custom validation
  }

  protected async validateUpdate(id: string, data: UpdateInput, userId: string): Promise<void> {
    // Override in subclass for custom validation
  }

  protected async validateDelete(id: string, userId: string): Promise<void> {
    // Override in subclass for custom validation
  }

  protected async transformCreateData(data: CreateInput, userId: string): Promise<any> {
    return data;
  }

  protected async transformUpdateData(data: UpdateInput, userId: string): Promise<any> {
    return data;
  }

  protected transformRecord(record: any): T {
    return record;
  }

  protected async afterCreate(record: T, userId: string): Promise<void> {
    // Override in subclass for post-create operations
  }

  protected async afterUpdate(record: T, userId: string): Promise<void> {
    // Override in subclass for post-update operations
  }

  protected async afterDelete(id: string, userId: string): Promise<void> {
    // Override in subclass for post-delete operations
  }

  protected getDefaultOrderBy(): any {
    return { createdAt: 'desc' };
  }

  protected getDefaultSelect(): any {
    return undefined;
  }

  protected getDefaultIncludes(): any {
    return undefined;
  }

  protected requiresOwnership(): boolean {
    return true;
  }

  protected shouldAuditLog(): boolean {
    return true;
  }

  protected getMaxRecordsPerUser(): number | undefined {
    return undefined;
  }

  protected async getUniquenessConstraint(data: CreateInput): Promise<
    | {
        field: string;
        value: any;
        message: string;
      }
    | undefined
  > {
    return undefined;
  }
}

// ============================================================================
// REPOSITORY FACTORY
// ============================================================================

export class RepositoryFactory {
  private static repositories: Map<string, any> = new Map();

  static register<T extends BaseRepository<any, any, any>>(name: string, repository: T): void {
    this.repositories.set(name, repository);
  }

  static get<T extends BaseRepository<any, any, any>>(name: string): T {
    const repository = this.repositories.get(name);
    if (!repository) {
      throw new Error(`Repository ${name} not found`);
    }
    return repository;
  }

  static has(name: string): boolean {
    return this.repositories.has(name);
  }
}
