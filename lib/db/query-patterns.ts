/**
 * Standardized Database Query Patterns
 *
 * This module provides consistent patterns for database operations
 * including error handling, transactions, validation, and access control
 */

import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../prisma';
import { logger } from '../utils/logger';
import {
  sendInternalError,
  sendNotFound,
  sendValidationError,
  sendForbidden,
} from '../utils/api-response';
import { NextApiResponse } from 'next';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface QueryOptions<T = any> {
  // Pagination
  page?: number;
  limit?: number;

  // Sorting
  orderBy?: Prisma.Enumerable<T>;

  // Filtering
  where?: Prisma.InputJsonValue;

  // Relations
  include?: Prisma.InputJsonValue;
  select?: Prisma.InputJsonValue;

  // Security
  userId?: string;
  validateOwnership?: boolean;
}

export interface TransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
}

export interface QueryResult<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized database error handler
 */
export async function handleDatabaseError(
  error: unknown,
  context: {
    operation: string;
    userId?: string;
    resource?: string;
    requestId?: string;
  },
): Promise<never> {
  const { operation, userId, resource, requestId } = context;

  // Log the error with context
  logger.error('Database operation failed', {
    operation,
    userId,
    resource,
    requestId,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });

  // Handle specific Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        throw new Error(`${resource || 'Resource'} already exists`);

      case 'P2025': // Record not found
        throw new Error(`${resource || 'Resource'} not found`);

      case 'P2003': // Foreign key constraint violation
        throw new Error('Related resource not found');

      case 'P2014': // Relation violation
        throw new Error('Invalid relationship');

      default:
        throw new Error('Database operation failed');
    }
  }

  // Handle validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new Error('Invalid data provided');
  }

  // Generic error
  throw error instanceof Error ? error : new Error('Database operation failed');
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

/**
 * Build user-scoped query filters
 */
export function buildUserScopedWhere<T extends { userId?: string }>(
  userId: string,
  baseWhere?: Prisma.InputJsonValue,
  options?: {
    includeDeleted?: boolean;
    additionalFilters?: Record<string, any>;
  },
): any {
  const where: any = {
    userId,
    ...(baseWhere || {}),
    ...(options?.additionalFilters || {}),
  };

  // Exclude soft-deleted records by default
  if (!options?.includeDeleted) {
    where.deletedAt = null;
  }

  return where;
}

/**
 * Validate user ownership of a resource
 */
export async function validateUserOwnership<T extends { userId: string }>(
  model: any,
  resourceId: string,
  userId: string,
  resourceName: string = 'Resource',
): Promise<T> {
  const resource = await model.findFirst({
    where: {
      id: resourceId,
      userId,
      deletedAt: null,
    },
  });

  if (!resource) {
    throw new Error(`${resourceName} not found or access denied`);
  }

  return resource;
}

// ============================================================================
// TRANSACTION PATTERNS
// ============================================================================

/**
 * Execute database operations in a transaction with retry logic
 */
export async function withTransaction<T>(
  operation: (tx: PrismaClient) => Promise<T>,
  options?: TransactionOptions & { retries?: number },
): Promise<T> {
  const maxRetries = options?.retries || 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          return await operation(tx as PrismaClient);
        },
        {
          isolationLevel: options?.isolationLevel,
          maxWait: options?.maxWait || 5000,
          timeout: options?.timeout || 10000,
        },
      );
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors
      if (
        error instanceof Prisma.PrismaClientValidationError ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2003'].includes(error.code))
      ) {
        throw error;
      }

      // Log retry attempt
      logger.warn('Transaction retry', {
        attempt,
        maxRetries,
        error: lastError.message,
      });

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  throw lastError || new Error('Transaction failed after retries');
}

// ============================================================================
// QUERY PATTERNS
// ============================================================================

/**
 * Standardized findMany with pagination and filtering
 */
export async function findManyWithPagination<T>(
  model: any,
  options: QueryOptions<T>,
): Promise<QueryResult<T[]>> {
  const {
    page = 1,
    limit = 20,
    orderBy,
    where,
    include,
    select,
    userId,
    validateOwnership = true,
  } = options;

  // Build secure where clause
  const secureWhere = userId && validateOwnership ? buildUserScopedWhere(userId, where) : where;

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute queries in parallel
  const [data, total] = await Promise.all([
    model.findMany({
      where: secureWhere,
      orderBy: orderBy || { createdAt: 'desc' },
      skip,
      take: limit,
      ...(include && { include }),
      ...(select && { select }),
    }),
    model.count({ where: secureWhere }),
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrevious = page > 1;

  return {
    data,
    meta: {
      total,
      page,
      limit,
      hasNext,
      hasPrevious,
    },
  };
}

/**
 * Standardized findUnique with ownership validation
 */
export async function findUniqueSecure<T extends { userId?: string }>(
  model: any,
  id: string,
  userId?: string,
  options?: {
    include?: Prisma.InputJsonValue;
    select?: Prisma.InputJsonValue;
  },
): Promise<T> {
  const where: any = { id };

  // Add user scoping if provided
  if (userId) {
    where.userId = userId;
  }

  const resource = await model.findFirst({
    where: {
      ...where,
      deletedAt: null,
    },
    ...(options?.include && { include: options.include }),
    ...(options?.select && { select: options.select }),
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  return resource;
}

/**
 * Standardized create with validation
 */
export async function createSecure<T>(
  model: any,
  data: any,
  userId: string,
  options?: {
    validateUniqueness?: { field: string; value: any; message: string };
    maxRecords?: number;
    auditLog?: boolean;
  },
): Promise<T> {
  // Check uniqueness if required
  if (options?.validateUniqueness) {
    const existing = await model.findFirst({
      where: {
        [options.validateUniqueness.field]: options.validateUniqueness.value,
        userId,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new Error(options.validateUniqueness.message);
    }
  }

  // Check record limit if specified
  if (options?.maxRecords) {
    const count = await model.count({
      where: {
        userId,
        deletedAt: null,
      },
    });

    if (count >= options.maxRecords) {
      throw new Error(`Maximum number of records (${options.maxRecords}) reached`);
    }
  }

  // Create the record
  const record = await model.create({
    data: {
      ...data,
      userId,
    },
  });

  // Create audit log if requested
  if (options?.auditLog) {
    await prisma.auditLog
      .create({
        data: {
          event: 'RECORD_CREATED',
          userId,
          resourceType: model.name,
          resourceId: record.id,
          metadata: { data },
          success: true,
        },
      })
      .catch((err) => logger.error('Audit log creation failed', err));
  }

  return record;
}

/**
 * Standardized update with ownership validation
 */
export async function updateSecure<T>(
  model: any,
  id: string,
  data: any,
  userId: string,
  options?: {
    validateOwnership?: boolean;
    auditLog?: boolean;
  },
): Promise<T> {
  const where: any = { id };

  // Validate ownership if required
  if (options?.validateOwnership !== false) {
    where.userId = userId;
  }

  const record = await model.update({
    where,
    data,
  });

  // Create audit log if requested
  if (options?.auditLog) {
    await prisma.auditLog
      .create({
        data: {
          event: 'RECORD_UPDATED',
          userId,
          resourceType: model.name,
          resourceId: id,
          metadata: { changes: data },
          success: true,
        },
      })
      .catch((err) => logger.error('Audit log creation failed', err));
  }

  return record;
}

/**
 * Standardized soft delete with ownership validation
 */
export async function softDeleteSecure<T>(
  model: any,
  id: string,
  userId: string,
  options?: {
    validateOwnership?: boolean;
    auditLog?: boolean;
  },
): Promise<T> {
  const where: any = { id };

  // Validate ownership if required
  if (options?.validateOwnership !== false) {
    where.userId = userId;
  }

  const record = await model.update({
    where,
    data: {
      deletedAt: new Date(),
    },
  });

  // Create audit log if requested
  if (options?.auditLog) {
    await prisma.auditLog
      .create({
        data: {
          event: 'RECORD_DELETED',
          userId,
          resourceType: model.name,
          resourceId: id,
          success: true,
        },
      })
      .catch((err) => logger.error('Audit log creation failed', err));
  }

  return record;
}

// ============================================================================
// AGGREGATION PATTERNS
// ============================================================================

/**
 * Standardized aggregation with user scoping
 */
export async function aggregateSecure(
  model: any,
  userId: string,
  options: {
    _sum?: Record<string, boolean>;
    _avg?: Record<string, boolean>;
    _count?: boolean | Record<string, boolean>;
    _min?: Record<string, boolean>;
    _max?: Record<string, boolean>;
    where?: Prisma.InputJsonValue;
    groupBy?: string[];
  },
): Promise<any> {
  const secureWhere = buildUserScopedWhere(userId, options.where);

  if (options.groupBy) {
    return await model.groupBy({
      by: options.groupBy,
      where: secureWhere,
      _sum: options._sum,
      _avg: options._avg,
      _count: options._count,
      _min: options._min,
      _max: options._max,
    });
  }

  return await model.aggregate({
    where: secureWhere,
    _sum: options._sum,
    _avg: options._avg,
    _count: options._count,
    _min: options._min,
    _max: options._max,
  });
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Standardized batch create with validation
 */
export async function batchCreateSecure<T>(
  model: any,
  data: any[],
  userId: string,
  options?: {
    skipDuplicates?: boolean;
    maxBatchSize?: number;
  },
): Promise<{ count: number; records?: T[] }> {
  const maxSize = options?.maxBatchSize || 100;

  if (data.length > maxSize) {
    throw new Error(`Batch size exceeds maximum of ${maxSize}`);
  }

  // Add userId to all records
  const secureData = data.map((item) => ({
    ...item,
    userId,
  }));

  const result = await model.createMany({
    data: secureData,
    skipDuplicates: options?.skipDuplicates,
  });

  return { count: result.count };
}

/**
 * Standardized batch update with ownership validation
 */
export async function batchUpdateSecure(
  model: any,
  ids: string[],
  data: any,
  userId: string,
): Promise<{ count: number }> {
  const result = await model.updateMany({
    where: {
      id: { in: ids },
      userId,
      deletedAt: null,
    },
    data,
  });

  return { count: result.count };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Retry a database operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain errors
      if (
        error instanceof Prisma.PrismaClientValidationError ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2025'].includes(error.code))
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', error);
    return false;
  }
}
