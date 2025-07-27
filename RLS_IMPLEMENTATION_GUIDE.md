# Row-Level Security (RLS) Implementation Guide

## Overview

This guide documents the implementation of PostgreSQL Row-Level Security (RLS)
policies for the TAAXDOG application, ensuring users can only access their own
data while maintaining admin bypass capabilities.

## Files Created

### 1. Database Migration

**File**: `migrations/add_row_level_security.sql`

- Enables RLS on all sensitive tables
- Creates user isolation policies
- Implements admin bypass policies
- Adds performance indexes
- Includes helper functions for user context

### 2. Prisma RLS Client

**File**: `lib/prisma-rls.ts`

- Extended PrismaClient with RLS support
- `setUserContext()` method for setting PostgreSQL session variables
- `withUserContext()` for executing queries within RLS context
- Singleton pattern for connection management

### 3. RLS Middleware

**File**: `lib/middleware/rls-middleware.ts`

- `withRLSMiddleware()` - Main middleware for API routes
- `requireAdmin()` - Admin-only route protection
- `requireRoles()` - Role-based access control
- Error handling utilities
- Pagination helpers

### 4. Example Implementation

**File**: `pages/api/goals/index-rls.ts`

- Demonstrates RLS usage in API routes
- Shows both GET and POST operations with RLS
- Includes proper error handling

### 5. Testing & Deployment Scripts

**Files**:

- `scripts/test-rls-policies.ts` - Test suite for RLS policies
- `scripts/apply-rls-migration.sh` - Migration deployment script

## Implementation Steps

### 1. Apply the Migration

```bash
# Using the provided script
npm run apply-rls-migration

# Or manually with psql
psql -U your_user -d your_database -f migrations/add_row_level_security.sql
```

### 2. Update Package.json Scripts

Add these scripts to your package.json:

```json
{
  "scripts": {
    "apply-rls-migration": "./scripts/apply-rls-migration.sh",
    "test-rls": "ts-node scripts/test-rls-policies.ts"
  }
}
```

### 3. Update API Routes

Convert existing API routes to use RLS middleware:

**Before:**

```typescript
import prisma from '@/lib/prisma';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
  });

  return res.json(goals);
}
```

**After:**

```typescript
import { withRLSMiddleware } from '@/lib/middleware/rls-middleware';
import prismaWithRLS from '@/lib/prisma-rls';

async function handler(req, res) {
  // RLS automatically filters by user
  const goals = await req.rlsContext.execute(async () => {
    return await prismaWithRLS.goal.findMany();
  });

  return res.json(goals);
}

export default withRLSMiddleware(handler);
```

## Security Features

### 1. User Data Isolation

- Each user can only access their own records
- Policies enforce isolation at the database level
- No accidental data leaks through code errors

### 2. Admin Access

- Admins can access all data through bypass policies
- Admin status checked via `is_admin()` function
- Separate policies for each table

### 3. Cascading Access

- Related data access through foreign keys
- Example: Users access subaccounts through their bank connections
- Maintains referential integrity

### 4. Performance Optimization

- Indexes on commonly queried fields
- Efficient policy checks using session variables
- Minimal overhead for RLS operations

## Best Practices

### 1. Always Use RLS Context

```typescript
// Good - Uses RLS context
const data = await req.rlsContext.execute(async () => {
  return await prismaWithRLS.model.findMany();
});

// Bad - Bypasses RLS
const data = await prisma.model.findMany();
```

### 2. Handle Errors Properly

```typescript
import { handleRLSError } from '@/lib/middleware/rls-middleware';

try {
  // Your RLS operations
} catch (error) {
  return handleRLSError(error, res);
}
```

### 3. Test Your Policies

Run the test suite after implementation:

```bash
npm run test-rls
```

## Migration Checklist

- [ ] Apply RLS migration to database
- [ ] Update all API routes to use RLS middleware
- [ ] Remove manual userId filters from queries
- [ ] Test all endpoints with different user roles
- [ ] Monitor logs for RLS-related errors
- [ ] Update documentation for new patterns

## Troubleshooting

### Common Issues

1. **"User ID is required for RLS operations"**
   - Ensure session is valid before RLS operations
   - Check authentication middleware is applied

2. **"Failed to set security context"**
   - Verify database user has proper permissions
   - Check PostgreSQL version supports RLS (9.5+)

3. **Performance degradation**
   - Ensure indexes are created on foreign key columns
   - Monitor slow queries with RLS enabled
   - Consider query optimization for complex policies

## Security Considerations

1. **Never bypass RLS in production code**
2. **Always validate user sessions before RLS operations**
3. **Log all admin access for audit trails**
4. **Regularly review and update policies**
5. **Test policies with different user scenarios**

## Next Steps

1. Implement field-level encryption for sensitive data
2. Add audit logging for data access
3. Create RLS policies for new tables as they're added
4. Consider implementing data masking for partial access
5. Set up monitoring for RLS policy violations
