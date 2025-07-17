# Performance Indexes Added to Prisma Schema

This document summarizes the performance indexes added to improve database query performance.

## Indexes Added

### 1. User Model
```prisma
@@index([email])
@@index([createdAt])
```
**Purpose:**
- `email` index: Speeds up user lookups by email (login, registration, password reset)
- `createdAt` index: Improves queries for user analytics and sorting by registration date

### 2. Goal Model
```prisma
@@index([userId])
@@index([status])
@@index([targetDate])
@@index([category])
@@index([userId, status])  // Composite index
```
**Purpose:**
- `userId` index: Fast retrieval of user's goals
- `status` index: Quick filtering by goal status (ACTIVE, COMPLETED, etc.)
- `targetDate` index: Sorting and filtering by due dates
- `category` index: Filtering goals by category
- `[userId, status]` composite: Optimizes common query pattern for active goals per user

### 3. bank_transactions Model (Transaction equivalent)
```prisma
@@index([bank_account_id])
@@index([transaction_date])
@@index([category])
@@index([bank_account_id, transaction_date])  // Composite index
```
**Purpose:**
- `bank_account_id` index: Fast retrieval of transactions per account
- `transaction_date` index: Date range queries for transaction history
- `category` index: Expense categorization and filtering
- `[bank_account_id, transaction_date]` composite: Optimizes account transaction history queries

### 4. Receipt Model
```prisma
@@index([userId], map: "idx_receipts_user_id")
@@index([date], map: "idx_receipts_date") 
@@index([merchant], map: "idx_receipts_merchant")
@@index([processingStatus], map: "idx_receipts_processing_status")
@@index([createdAt], map: "idx_receipts_processed_at")  // New index
```
**Purpose:**
- `userId` index: Fast retrieval of user's receipts
- `date` index: Date range queries for receipts
- `merchant` index: Searching by merchant name
- `processingStatus` index: Filtering by processing status
- `createdAt` index: Sorting by upload/processing time

## Migration Commands

To apply these indexes to your database, run:

```bash
# Generate migration
npx prisma migrate dev --name add_performance_indexes

# Or if in production
npx prisma migrate deploy
```

## Performance Impact

These indexes will significantly improve query performance for:

1. **User Operations:**
   - Login/authentication (email lookup)
   - User listing and analytics (createdAt sorting)

2. **Goal Queries:**
   - Dashboard goal display (userId + status)
   - Goal filtering and categorization
   - Timeline/calendar views (targetDate)

3. **Transaction Queries:**
   - Account transaction history
   - Date range filtering
   - Expense categorization
   - Monthly/yearly reports

4. **Receipt Queries:**
   - User receipt management
   - Processing status monitoring
   - Merchant analytics
   - Date-based reporting

## Query Examples That Will Benefit

```typescript
// User queries
await prisma.user.findUnique({ where: { email } });  // Uses email index
await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });  // Uses createdAt index

// Goal queries
await prisma.goal.findMany({ 
  where: { userId, status: 'ACTIVE' }  // Uses composite index
});

// Transaction queries
await prisma.bank_transactions.findMany({
  where: { 
    bank_account_id,
    transaction_date: { gte: startDate, lte: endDate }
  }  // Uses composite index
});

// Receipt queries
await prisma.receipt.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' }  // Uses both indexes
});
```

## Monitoring Performance

After applying indexes, monitor query performance using:

1. **Prisma Query Logging:**
```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

2. **PostgreSQL EXPLAIN ANALYZE:**
```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';
```

3. **Database Monitoring Tools:**
- pgAdmin
- PostgreSQL's pg_stat_statements
- Application performance monitoring (APM) tools

## Index Maintenance

- Indexes are automatically updated when data changes
- Monitor index bloat with `pg_stat_user_indexes`
- Consider periodic `REINDEX` for heavily updated tables
- Review slow query logs regularly to identify new indexing opportunities