# RLS Migration Guide for API Routes

This guide shows how to migrate existing API routes to use Row-Level Security (RLS) middleware.

## Migration Steps

### 1. Import RLS Dependencies

Replace standard imports:
```typescript
// OLD
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// NEW
import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import prismaWithRLS from '@/lib/prisma-rls';
```

### 2. Update Handler Function

Convert the handler to use RLS:
```typescript
// OLD
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;
  // ... rest of handler
}

// NEW
async function handler(
  req: NextApiRequestWithRLS,
  res: NextApiResponse
) {
  if (!req.rlsContext) {
    return res.status(500).json({ error: 'RLS context not initialized' });
  }
  // No need to check session - middleware handles it
  // userId is available as req.rlsContext.userId
  // ... rest of handler
}

export default withRLSMiddleware(handler);
```

### 3. Update Database Queries

Remove manual userId filtering:
```typescript
// OLD - Manual filtering
const goals = await prisma.goal.findMany({
  where: { userId: session.user.id }
});

// NEW - RLS automatic filtering
const goals = await req.rlsContext.execute(async () => {
  return await prismaWithRLS.goal.findMany();
});
```

### 4. Error Handling

Use the RLS error handler:
```typescript
// OLD
try {
  // ... database operations
} catch (error) {
  console.error('Error:', error);
  return res.status(500).json({ error: 'Failed to process request' });
}

// NEW
try {
  // ... database operations
} catch (error) {
  return handleRLSError(error, res);
}
```

## Complete Migration Examples

### Example 1: Goals API Routes

#### Before (pages/api/goals/index.ts):
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { GoalService } from '@/lib/goals/goal-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  if (req.method === 'GET') {
    try {
      const goals = await GoalService.fetchGoals(userId);
      return res.status(200).json(goals);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch goals' });
    }
  }
}
```

#### After (pages/api/goals/index.ts):
```typescript
import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { GoalServiceRLS } from '@/lib/goals/goal-service-rls';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (!req.rlsContext) {
    return res.status(500).json({ error: 'RLS context not initialized' });
  }

  if (req.method === 'GET') {
    try {
      const goals = await req.rlsContext.execute(async () => {
        return await GoalServiceRLS.fetchGoals();
      });
      return res.status(200).json(goals);
    } catch (error) {
      return handleRLSError(error, res);
    }
  }
}

export default withRLSMiddleware(handler);
```

### Example 2: Receipts API Routes

#### Before:
```typescript
const receipts = await prisma.receipt.findMany({
  where: { 
    userId: session.user.id,
    processingStatus: 'PROCESSED'
  },
  orderBy: { date: 'desc' }
});
```

#### After:
```typescript
const receipts = await req.rlsContext.execute(async () => {
  return await prismaWithRLS.receipt.findMany({
    where: { 
      processingStatus: 'PROCESSED' // No need for userId filter
    },
    orderBy: { date: 'desc' }
  });
});
```

## API Routes to Update

### High Priority (User Data):
- [x] `/api/goals/*` - Goals management
- [ ] `/api/receipts/*` - Receipt processing
- [ ] `/api/budgets/*` - Budget tracking
- [ ] `/api/banking/*` - Banking transactions
- [ ] `/api/ai/*` - AI insights and conversations

### Medium Priority (Settings/Profile):
- [ ] `/api/auth/profile` - User profile
- [ ] `/api/auth/sessions` - Active sessions
- [ ] `/api/stripe/*` - Subscription management

### Admin Routes:
For admin-only routes, use the `requireAdmin` middleware:
```typescript
import { requireAdmin } from '@/lib/middleware/rls-middleware';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  // Only admins can access this route
}

export default requireAdmin(handler);
```

## Testing Your Migration

1. **Test Data Access**: Verify users can only see their own data
2. **Test Create Operations**: Ensure new records are properly associated
3. **Test Update/Delete**: Confirm users can only modify their own records
4. **Test Admin Access**: Verify admins can access all data when needed

## Common Issues and Solutions

### Issue: "Goal not found" when it exists
**Solution**: This means RLS is working! The user doesn't own that resource.

### Issue: Performance degradation
**Solution**: Ensure indexes exist on foreign key columns used in RLS policies.

### Issue: Admin operations failing
**Solution**: Make sure admin bypass policies are in place and user role is set correctly.

## Rollback Plan

If you need to temporarily disable RLS:
```sql
-- Disable RLS on a table
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;

-- Or drop all policies
DROP POLICY IF EXISTS goal_isolation_policy ON goals;
DROP POLICY IF EXISTS admin_bypass_goal ON goals;
```

## Benefits After Migration

1. **Automatic Security**: No risk of forgetting WHERE clauses
2. **Cleaner Code**: Remove repetitive userId checks
3. **Database-Level Security**: Protection even if application code has bugs
4. **Performance**: Optimized with proper indexes
5. **Compliance**: Better audit trail and data isolation