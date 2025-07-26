# Quick Reference Guide

## Essential Commands

### Daily Development
```bash
npm run dev                 # Start dev server (http://localhost:3000)
npm test                    # Run all tests
npm run quality:check       # Run all quality checks
npm run fix:all            # Fix common issues automatically
```

### Before Committing
```bash
npm run validate           # TypeScript, ESLint, Prettier checks
npm test -- --coverage     # Ensure test coverage
npm run build             # Verify build works
```

### Database Operations
```bash
npx prisma studio         # Open database GUI
npx prisma generate       # Generate Prisma client
npx prisma migrate dev    # Create new migration
npm run test-db          # Test database connection
```

### Performance & Optimization
```bash
npm run analyze-bundle         # Analyze bundle size
npm run optimization:report    # Full optimization report
npm run monitoring:setup      # Setup performance monitoring
```

### Testing Specific Features
```bash
npm run test-auth         # Test authentication
npm run test-ai          # Test AI services
npm run test-basiq       # Test banking integration
npm run test-email       # Test email service
```

## Common Tasks

### Add New API Endpoint
```typescript
// pages/api/your-endpoint.ts
import { withAuth } from '@/lib/middleware/auth';
import { apiResponse } from '@/lib/api/response';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Your logic here
    return apiResponse.success(res, data);
  } catch (error) {
    return apiResponse.error(res, error.message, 500);
  }
}

export default withAuth(handler);
```

### Add New Component with Lazy Loading
```typescript
// components/lazy/LazyYourComponent.tsx
import { lazyImportWithRetry } from '@/lib/utils/dynamic-import';

export const LazyYourComponent = lazyImportWithRetry(
  () => import('../YourComponent'),
  'YourComponent'
);
```

### Add React Query Hook
```typescript
// hooks/queries/useYourData.ts
import { useQuery } from '@tanstack/react-query';

export function useYourData(id: string) {
  return useQuery({
    queryKey: ['your-data', id],
    queryFn: () => fetchYourData(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Add Test
```typescript
// __tests__/components/YourComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { YourComponent } from '@/components/YourComponent';

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Environment Variables

### Required for Development
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/taaxdog_dev
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Quick Environment Switch
```bash
npm run env:switch:dev      # Development
npm run env:switch:staging  # Staging
npm run env:switch:prod     # Production
```

## Troubleshooting

### Common Fixes
```bash
# TypeScript errors
rm -rf node_modules/.cache && npm run type-check

# Build errors
rm -rf .next && npm run build

# Test errors
npm test -- --clearCache

# Database errors
npx prisma generate && npm run migrate
```

### Debug Mode
```bash
DEBUG=taaxdog:* npm run dev
```

## Git Workflow

### Feature Development
```bash
git checkout -b feature/your-feature
# Make changes
npm run quality:check
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature
```

### Hotfix
```bash
git checkout -b hotfix/issue-description
# Fix issue
npm test
git add .
git commit -m "fix: issue description"
git push origin hotfix/issue-description
```

## Performance Tips

1. **Use React Query for data fetching** - Don't use useState + useEffect
2. **Lazy load heavy components** - Use dynamic imports
3. **Optimize images** - Use Next.js Image component
4. **Check bundle size** - Run analyze-bundle before major changes
5. **Monitor performance** - Check Sentry dashboard regularly

## Security Reminders

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Use Zod schemas
3. **Use middleware** - Apply auth, rate limiting, CSRF protection
4. **Encrypt sensitive data** - Use field encryption utilities
5. **Log security events** - Use audit logging

## Useful Links

- [Prisma Studio](http://localhost:5555) - Database GUI (when running)
- [API Docs](http://localhost:3000/api-docs) - API documentation
- [Sentry Dashboard](https://sentry.io) - Error & performance monitoring
- [GitHub Repo](https://github.com/TaaxDog/TAAXDOG-CODING) - Source code