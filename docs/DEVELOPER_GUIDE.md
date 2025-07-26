# Developer Guide

## Overview

This guide provides comprehensive information for developers working on the TAAXDOG project. It covers setup, development practices, testing, and deployment procedures.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Testing](#testing)
5. [Performance](#performance)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 14+
- Git
- VS Code (recommended) or your preferred IDE

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/TaaxDog/TAAXDOG-CODING.git
   cd TAAXDOG-CODING
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Database setup**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run test-db
   ```

5. **Start development**
   ```bash
   npm run dev
   ```

### Environment Configuration

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for detailed configuration.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - Authentication secret
- `ANTHROPIC_API_KEY` - AI service key
- `STRIPE_SECRET_KEY` - Payment processing
- `BASIQ_API_KEY` - Banking integration

## Development Workflow

### Branch Strategy

- `main` - Production branch
- `develop` - Development branch
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches
- `hotfix/*` - Emergency fixes

### Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run type-check       # TypeScript checking
npm run validate         # Run all checks

# Testing
npm test                 # Run all tests
npm test -- --watch      # Watch mode
npm test -- --coverage   # Coverage report
npm test [filename]      # Test specific file

# Optimization
npm run analyze-bundle   # Analyze bundle size
npm run optimization:report # Performance report

# Database
npm run migrate          # Run migrations
npx prisma studio        # Open database GUI
npm run test-db          # Test connection
```

### Git Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **Run quality checks**
   ```bash
   npm run quality:check
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Convention

Follow conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructuring
- `test:` - Tests
- `chore:` - Maintenance

## Code Standards

### TypeScript

- Use strict mode
- No `any` types without justification
- Prefer interfaces over types for objects
- Use enums for constants
- Document complex types

```typescript
// Good
interface User {
  id: string;
  email: string;
  role: UserRole;
}

enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

// Bad
const user: any = { id: '123' };
```

### React Components

- Use functional components with hooks
- Implement proper error boundaries
- Use React.memo for expensive components
- Lazy load heavy components

```typescript
// Good
const HeavyComponent = lazy(() => import('./HeavyComponent'));

export const MyComponent: React.FC<Props> = memo(({ data }) => {
  const [state, setState] = useState(initialState);
  
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent data={data} />
    </Suspense>
  );
});
```

### API Routes

Use standardized responses:

```typescript
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = await fetchData();
    return apiResponse.success(res, data);
  } catch (error) {
    return apiResponse.error(res, 'Failed to fetch data', 500);
  }
}
```

### Error Handling

- Always handle errors gracefully
- Log errors with context
- Provide user-friendly messages
- Use error boundaries in React

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', {
    error,
    context: { userId, operation: 'riskyOperation' }
  });
  throw new AppError('Something went wrong', 500);
}
```

## Testing

### Test Structure

```
__tests__/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── utils/         # Test utilities
```

### Writing Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Test Coverage

Maintain minimum 80% coverage:
- Statements: 80%
- Branches: 70%
- Functions: 80%
- Lines: 80%

## Performance

### Bundle Optimization

1. **Use dynamic imports**
   ```typescript
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <Skeleton />,
     ssr: false
   });
   ```

2. **Implement code splitting**
   ```typescript
   // pages/insights.tsx
   export default createLazyPage(
     '../components/insights/InsightsDashboard',
     'InsightsDashboard'
   );
   ```

3. **Optimize images**
   ```typescript
   import Image from 'next/image';
   
   <Image
     src="/hero.jpg"
     alt="Hero"
     width={1200}
     height={600}
     priority
     placeholder="blur"
   />
   ```

### React Query

Use for data fetching:

```typescript
import { useQuery } from '@tanstack/react-query';

export function useUserData(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });
}
```

### Performance Monitoring

- Web Vitals are tracked automatically
- Check Sentry dashboard for performance issues
- Run `npm run optimization:report` regularly
- Monitor bundle size with `npm run analyze-bundle`

## Deployment

### Pre-deployment Checklist

1. **Run all checks**
   ```bash
   npm run deploy:validate
   ```

2. **Test production build**
   ```bash
   npm run build
   npm run start
   ```

3. **Check environment variables**
   ```bash
   npm run env:validate
   ```

4. **Run security checks**
   ```bash
   npm run security:validate
   ```

### Deployment Process

1. **Merge to main branch**
   ```bash
   git checkout main
   git merge develop
   ```

2. **Tag release**
   ```bash
   git tag -a v0.1.0 -m "Release version 0.1.0"
   git push origin main --tags
   ```

3. **Deploy**
   - Automatic deployment via GitHub Actions
   - Or manual: `git push origin main`

4. **Post-deployment**
   - Monitor error rates in Sentry
   - Check performance metrics
   - Verify critical user flows

## Troubleshooting

### Common Issues

#### TypeScript Errors
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
npm run type-check
```

#### Database Issues
```bash
# Reset database
npx prisma migrate reset
npx prisma generate
npm run migrate
```

#### Build Failures
```bash
# Clean build
rm -rf .next
npm run build
```

#### Test Failures
```bash
# Clear Jest cache
npm test -- --clearCache
npm test
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=taaxdog:* npm run dev
```

### Performance Issues

1. Check bundle size: `npm run analyze-bundle`
2. Review Sentry performance data
3. Profile with React DevTools
4. Check database query performance

## Resources

- [Architecture Overview](./architecture.md)
- [API Documentation](./api-docs/)
- [Security Guide](./SECURITY.md)
- [Compliance Guide](./COMPLIANCE.md)
- [Bundle Optimization](./BUNDLE_OPTIMIZATION.md)
- [Sentry Performance](./SENTRY_PERFORMANCE.md)

## Support

- GitHub Issues: [Report bugs](https://github.com/TaaxDog/TAAXDOG-CODING/issues)
- Documentation: Check `/docs` directory
- Team Chat: Internal Slack channel