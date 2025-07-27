# Database Query Patterns Guide

This guide defines standardized patterns for all database operations in the TAAXDOG project, ensuring consistency, security, and maintainability.

## Table of Contents
1. [Core Principles](#core-principles)
2. [Query Patterns](#query-patterns)
3. [Error Handling](#error-handling)
4. [Transaction Management](#transaction-management)
5. [Access Control](#access-control)
6. [Repository Pattern](#repository-pattern)
7. [Best Practices](#best-practices)

## Core Principles

### 1. Security First
- **Always validate user ownership** before any operation
- **Use parameterized queries** (Prisma handles this automatically)
- **Implement Row-Level Security (RLS)** for sensitive data
- **Audit log all critical operations**

### 2. Consistency
- **Use standardized query helpers** from `lib/db/query-patterns.ts`
- **Follow the repository pattern** for complex entities
- **Maintain consistent error handling** across all queries

### 3. Performance
- **Use pagination** for list queries
- **Implement proper indexing** (see `prisma/schema.prisma`)
- **Batch operations** when possible
- **Cache frequently accessed data**

## Query Patterns

### Basic CRUD Operations

#### 1. Find Operations

```typescript
import { findManyWithPagination, findUniqueSecure } from '@/lib/db/query-patterns';

// Find many with pagination and user scoping
const result = await findManyWithPagination(prisma.goal, {
  userId: 'user123',
  page: 1,
  limit: 20,
  where: { status: 'ACTIVE' },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    name: true,
    targetAmount: true,
    currentAmount: true
  }
});

// Find one with ownership validation
const goal = await findUniqueSecure(
  prisma.goal,
  'goal123',
  'user123',
  {
    include: { subGoals: true }
  }
);
```

#### 2. Create Operations

```typescript
import { createSecure } from '@/lib/db/query-patterns';

// Create with validation and limits
const newGoal = await createSecure(
  prisma.goal,
  {
    name: 'Emergency Fund',
    targetAmount: 10000,
    deadline: new Date('2024-12-31')
  },
  userId,
  {
    maxRecords: 50, // Limit per user
    auditLog: true,
    validateUniqueness: {
      field: 'name',
      value: 'Emergency Fund',
      message: 'A goal with this name already exists'
    }
  }
);
```

#### 3. Update Operations

```typescript
import { updateSecure } from '@/lib/db/query-patterns';

// Update with ownership validation
const updatedGoal = await updateSecure(
  prisma.goal,
  goalId,
  { currentAmount: 5000 },
  userId,
  {
    validateOwnership: true,
    auditLog: true
  }
);
```

#### 4. Delete Operations

```typescript
import { softDeleteSecure } from '@/lib/db/query-patterns';

// Soft delete with audit log
await softDeleteSecure(
  prisma.goal,
  goalId,
  userId,
  {
    validateOwnership: true,
    auditLog: true
  }
);
```

### Aggregation Operations

```typescript
import { aggregateSecure } from '@/lib/db/query-patterns';

// Get user statistics
const stats = await aggregateSecure(prisma.transaction, userId, {
  _sum: {
    amount: true,
    gstAmount: true
  },
  _count: true,
  where: {
    date: {
      gte: new Date('2024-01-01'),
      lte: new Date('2024-12-31')
    }
  },
  groupBy: ['category']
});
```

## Error Handling

### Standardized Error Handler

```typescript
import { handleDatabaseError } from '@/lib/db/query-patterns';

try {
  // Database operation
} catch (error) {
  await handleDatabaseError(error, {
    operation: 'createGoal',
    userId: 'user123',
    resource: 'Goal',
    requestId: 'req123'
  });
}
```

### Error Types and Responses

```typescript
// Unique constraint violation
{
  "success": false,
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "Goal already exists"
  }
}

// Not found
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Goal not found"
  }
}

// Validation error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid data provided",
    "details": {
      "errors": [
        { "field": "amount", "message": "Must be positive" }
      ]
    }
  }
}
```

## Transaction Management

### Basic Transaction Pattern

```typescript
import { withTransaction } from '@/lib/db/query-patterns';

const result = await withTransaction(async (tx) => {
  // All operations use the transaction client
  const goal = await tx.goal.create({ data: goalData });
  const subGoal = await tx.subGoal.create({ data: { goalId: goal.id } });
  
  // Audit log within transaction
  await tx.auditLog.create({
    data: {
      event: 'GOAL_CREATED',
      userId,
      resourceId: goal.id
    }
  });
  
  return { goal, subGoal };
});
```

### Transaction with Retry

```typescript
const result = await withTransaction(
  async (tx) => {
    // Transaction operations
  },
  {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    retries: 3
  }
);
```

## Access Control

### User-Scoped Queries

```typescript
import { buildUserScopedWhere } from '@/lib/db/query-patterns';

// Build secure where clause
const where = buildUserScopedWhere(userId, {
  status: 'ACTIVE',
  category: 'SAVINGS'
});

// Results in:
// {
//   userId: 'user123',
//   status: 'ACTIVE',
//   category: 'SAVINGS',
//   deletedAt: null
// }
```

### Ownership Validation

```typescript
import { validateUserOwnership } from '@/lib/db/query-patterns';

// Validate before operations
const resource = await validateUserOwnership(
  prisma.goal,
  resourceId,
  userId,
  'Goal'
);
```

## Repository Pattern

### Base Repository

```typescript
import { BaseRepository } from '@/lib/repositories/base-repository';

export class GoalRepository extends BaseRepository<Goal, CreateGoalInput, UpdateGoalInput> {
  protected model = prisma.goal;
  protected modelName = 'Goal';
  
  // Custom business logic
  async findActiveGoals(userId: string) {
    return this.findMany({
      userId,
      where: { status: 'ACTIVE' }
    });
  }
  
  // Validation hooks
  protected async validateCreate(data: CreateGoalInput) {
    if (data.targetAmount <= 0) {
      throw new Error('Target amount must be positive');
    }
  }
}
```

### Using Repositories

```typescript
import { goalRepository } from '@/lib/repositories/goal-repository';

// In API endpoints
export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { userId } = req;
  
  try {
    // Use repository methods
    const goals = await goalRepository.findActiveGoals(userId);
    const newGoal = await goalRepository.create(req.body, userId);
    
    return sendSuccess(res, { goals });
  } catch (error) {
    return sendInternalError(res, error);
  }
}
```

## Best Practices

### 1. Always Use Transactions for Multi-Step Operations

```typescript
// Good
await withTransaction(async (tx) => {
  await tx.goal.update({ where: { id }, data: { status: 'COMPLETED' } });
  await tx.notification.create({ data: { userId, type: 'GOAL_COMPLETED' } });
});

// Bad - No transaction
await prisma.goal.update({ where: { id }, data: { status: 'COMPLETED' } });
await prisma.notification.create({ data: { userId, type: 'GOAL_COMPLETED' } });
```

### 2. Implement Proper Pagination

```typescript
// Good
const result = await findManyWithPagination(prisma.transaction, {
  userId,
  page: req.query.page || 1,
  limit: Math.min(req.query.limit || 20, 100) // Cap at 100
});

// Bad - No pagination
const allTransactions = await prisma.transaction.findMany({
  where: { userId }
});
```

### 3. Use Select to Limit Data Transfer

```typescript
// Good - Only select needed fields
const goals = await prisma.goal.findMany({
  select: {
    id: true,
    name: true,
    targetAmount: true,
    currentAmount: true
  }
});

// Bad - Fetches all fields
const goals = await prisma.goal.findMany();
```

### 4. Handle Decimal Values Properly

```typescript
// Good - Convert Decimal to number
const transformRecord = (record: any) => ({
  ...record,
  amount: Number(record.amount),
  gstAmount: Number(record.gstAmount)
});

// Bad - Decimal objects in response
return res.json({ amount: record.amount }); // Decimal object
```

### 5. Implement Audit Logging

```typescript
// Good - Audit critical operations
await createSecure(prisma.goal, data, userId, {
  auditLog: true
});

// Log includes:
// - Operation type
// - User ID
// - Resource ID
// - Timestamp
// - Success/failure
// - Metadata
```

### 6. Use Consistent Date Handling

```typescript
// Good - Consistent timezone handling
const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);

const endOfDay = new Date();
endOfDay.setHours(23, 59, 59, 999);

// Bad - Timezone issues
const today = new Date().toISOString().split('T')[0];
```

### 7. Implement Retry Logic for Transient Failures

```typescript
import { retryOperation } from '@/lib/db/query-patterns';

// Good - Retry on transient failures
const result = await retryOperation(
  async () => await prisma.transaction.findMany({ where }),
  3, // max retries
  100 // base delay in ms
);
```

## Security Considerations

1. **Never trust user input** - Always validate and sanitize
2. **Use parameterized queries** - Prisma handles this automatically
3. **Implement row-level security** - Filter by userId
4. **Audit sensitive operations** - Track who did what and when
5. **Handle errors carefully** - Don't leak sensitive information
6. **Use transactions for consistency** - Prevent partial updates
7. **Implement rate limiting** - Prevent abuse

## Performance Tips

1. **Use indexes wisely** - Check `prisma/schema.prisma` for index definitions
2. **Batch operations** - Use `createMany`, `updateMany` when possible
3. **Limit query complexity** - Use pagination and field selection
4. **Cache frequently accessed data** - Especially for aggregations
5. **Monitor query performance** - Use Prisma's query analysis tools
6. **Optimize N+1 queries** - Use `include` carefully

## Migration to New Patterns

When updating existing code:

1. Replace direct Prisma calls with pattern functions
2. Add proper error handling
3. Implement user scoping
4. Add audit logging for critical operations
5. Test thoroughly, especially access control

Example migration:

```typescript
// Before
const goals = await prisma.goal.findMany({
  where: { userId }
});

// After
const result = await findManyWithPagination(prisma.goal, {
  userId,
  page: 1,
  limit: 20
});
const goals = result.data;
```