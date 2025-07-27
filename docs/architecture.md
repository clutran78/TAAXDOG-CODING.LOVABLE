# TAAXDOG Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Architecture Principles](#architecture-principles)
4. [Core Components](#core-components)
5. [Naming Conventions](#naming-conventions)
6. [Coding Patterns](#coding-patterns)
7. [Data Flow](#data-flow)
8. [Security Architecture](#security-architecture)
9. [Performance Considerations](#performance-considerations)
10. [Development Guidelines](#development-guidelines)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Architecture](#deployment-architecture)

## Overview

TAAXDOG is a comprehensive Australian tax and financial management platform built with Next.js 15.3.4, TypeScript, and React 19. The architecture prioritizes security, performance, and Australian regulatory compliance while maintaining a clean, scalable codebase.

### Technology Stack

- **Frontend**: React 19, Next.js 15.3.4, TypeScript
- **Styling**: Tailwind CSS v4, CSS Modules
- **Backend**: Next.js API Routes, Python Flask (for heavy processing)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with JWT sessions
- **Payment Processing**: Stripe
- **Banking Integration**: BASIQ API
- **AI Services**: Multi-provider (Anthropic, OpenRouter, Gemini)
- **Deployment**: DigitalOcean App Platform

## Project Structure

```
TAAXDOG-CODING/
├── components/           # React components organized by feature
│   ├── auth/            # Authentication components
│   ├── banking/         # Banking integration components
│   ├── basiq/           # BASIQ-specific components
│   ├── budget/          # Budget management components
│   ├── dashboard/       # Dashboard components
│   ├── Goal/            # Financial goals components
│   ├── insights/        # Financial insights components
│   ├── lazy/            # Lazy-loaded components
│   ├── monitoring/      # System monitoring components
│   ├── patterns/        # Reusable UI patterns
│   ├── receipts/        # Receipt management components
│   ├── transactions/    # Transaction components
│   └── ui/              # Base UI components
├── hooks/               # Custom React hooks
├── lib/                 # Core libraries and utilities
│   ├── ai/              # AI service integration
│   ├── auth/            # Authentication utilities
│   ├── basiq/           # BASIQ API client
│   ├── constants/       # Application constants
│   ├── db/              # Database utilities
│   ├── errors/          # Error handling
│   ├── middleware/      # API middleware
│   ├── monitoring/      # Performance monitoring
│   ├── repositories/    # Data access layer
│   ├── routes/          # Route definitions
│   ├── security/        # Security utilities
│   ├── services/        # Business logic services
│   ├── stripe/          # Stripe integration
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # General utilities
│   └── validation/      # Input validation
├── pages/               # Next.js pages and API routes
│   ├── api/             # API endpoints
│   ├── admin/           # Admin pages
│   ├── auth/            # Authentication pages
│   ├── banking/         # Banking pages
│   ├── dashboard/       # Dashboard pages
│   └── transactions/    # Transaction pages
├── prisma/              # Database schema and migrations
├── public/              # Static assets
├── scripts/             # Build and maintenance scripts
├── styles/              # Global styles
├── tests/               # Test suites
└── backend/             # Python Flask backend

```

## Architecture Principles

### 1. Separation of Concerns

- **Components**: Purely presentational, receive data via props
- **Hooks**: Encapsulate stateful logic and side effects
- **Services**: Business logic and external API interactions
- **Repositories**: Data access and database operations
- **Middleware**: Cross-cutting concerns (auth, logging, validation)

### 2. Type Safety

- Strict TypeScript configuration with all checks enabled
- Comprehensive type definitions for all data structures
- No implicit `any` types allowed
- Proper error boundaries with typed error handling

### 3. Security First

- All endpoints protected by authentication middleware
- Input validation on every API route
- SQL injection prevention through Prisma parameterized queries
- XSS protection via React's built-in escaping
- CSRF tokens for state-changing operations
- Rate limiting on all endpoints

### 4. Performance Optimization

- Lazy loading for heavy components
- Memoization of expensive computations
- Optimistic UI updates
- Efficient database queries with proper indexing
- Redis caching for frequently accessed data

## Core Components

### Authentication System

```typescript
// lib/auth/auth-utils.ts
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  verified: boolean;
  twoFactorEnabled: boolean;
}

// Middleware composition pattern
export const protectedRoute = withAuth(
  withRateLimit(
    withValidation(handler)
  )
);
```

### Service Architecture

```typescript
// lib/services/base-service.ts
export abstract class BaseService<T> {
  protected repository: Repository<T>;
  
  abstract validate(data: unknown): T;
  abstract process(data: T): Promise<T>;
  
  async execute(input: unknown): Promise<T> {
    const validated = this.validate(input);
    return this.process(validated);
  }
}
```

### Repository Pattern

```typescript
// lib/repositories/base-repository.ts
export abstract class BaseRepository<T> {
  protected prisma: PrismaClient;
  
  abstract findById(id: string): Promise<T | null>;
  abstract findMany(filter: FilterOptions): Promise<T[]>;
  abstract create(data: CreateInput<T>): Promise<T>;
  abstract update(id: string, data: UpdateInput<T>): Promise<T>;
  abstract delete(id: string): Promise<void>;
}
```

## Naming Conventions

### Files and Directories

- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useAuth.ts`)
- **Utilities**: camelCase (e.g., `formatCurrency.ts`)
- **Types**: PascalCase with descriptive suffixes (e.g., `UserResponse.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)

### Code Conventions

```typescript
// Interfaces - PascalCase, no 'I' prefix
interface UserProfile {
  id: string;
  email: string;
}

// Types - PascalCase
type UserRole = 'USER' | 'ADMIN' | 'ACCOUNTANT';

// Enums - PascalCase with UPPER_SNAKE_CASE members
enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// Functions - camelCase
function calculateTax(income: number): number {
  return income * TAX_RATE;
}

// Constants - UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// React Components - PascalCase
const UserDashboard: React.FC<Props> = ({ user }) => {
  return <div>{user.name}</div>;
};
```

## Coding Patterns

### API Route Pattern

```typescript
// pages/api/resource/[id].ts
import { withMiddleware } from '@/lib/middleware';
import { validateRequest } from '@/lib/validation';
import { ResourceService } from '@/lib/services';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  
  switch (method) {
    case 'GET':
      return handleGet(req, res);
    case 'PUT':
      return handleUpdate(req, res);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

export default withMiddleware(handler, {
  auth: true,
  rateLimit: true,
  validation: true
});
```

### React Component Pattern

```typescript
// components/feature/Component.tsx
import React, { memo, useCallback, useMemo } from 'react';
import { useFeature } from '@/hooks/useFeature';
import { ComponentProps } from './types';

export const Component = memo<ComponentProps>(({ 
  data, 
  onAction 
}) => {
  const { state, actions } = useFeature();
  
  const processedData = useMemo(() => 
    processData(data), [data]
  );
  
  const handleAction = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    onAction(processedData);
  }, [processedData, onAction]);
  
  return (
    <div className="component">
      {/* Component content */}
    </div>
  );
});

Component.displayName = 'Component';
```

### Custom Hook Pattern

```typescript
// hooks/useFeature.ts
import { useState, useEffect, useCallback } from 'react';
import { FeatureService } from '@/lib/services';

export function useFeature(initialData?: FeatureData) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await FeatureService.fetch();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}
```

## Data Flow

### Request Lifecycle

1. **Client Request** → Next.js Router
2. **Route Handler** → Middleware Stack
3. **Authentication** → Verify JWT token
4. **Authorization** → Check user permissions
5. **Validation** → Validate request data
6. **Rate Limiting** → Check request limits
7. **Business Logic** → Service layer processing
8. **Data Access** → Repository pattern
9. **Response** → Standardized API response

### State Management

- **Local State**: React hooks for component state
- **Global State**: Context API for app-wide state
- **Server State**: React Query for API data caching
- **Form State**: Formik with Yup validation

## Security Architecture

### Authentication Flow

```
User Login → Credentials Validation → JWT Generation → Session Creation
     ↓                                        ↓
Two-Factor Auth (if enabled)          Refresh Token Storage
     ↓
Protected Route Access
```

### API Security Layers

1. **HTTPS Only**: All traffic encrypted
2. **Authentication**: JWT tokens with short expiry
3. **Authorization**: Role-based access control (RBAC)
4. **Input Validation**: Comprehensive schema validation
5. **SQL Injection Prevention**: Parameterized queries
6. **XSS Protection**: Content Security Policy headers
7. **Rate Limiting**: Per-user and per-IP limits
8. **CSRF Protection**: Token validation on mutations

### Data Encryption

- **At Rest**: AES-256-GCM for sensitive fields
- **In Transit**: TLS 1.3 minimum
- **Keys**: Stored in environment variables
- **Backups**: Encrypted with separate keys

## Performance Considerations

### Database Optimization

```typescript
// Efficient query patterns
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    profile: {
      select: {
        name: true,
        avatar: true
      }
    }
  }
});

// Use database views for complex queries
const analytics = await prisma.$queryRaw`
  SELECT * FROM user_analytics_view 
  WHERE user_id = ${userId}
`;
```

### Caching Strategy

- **Redis**: Session data, API responses
- **In-Memory**: Computed values, lookup tables
- **Browser**: Static assets, API responses
- **CDN**: Images, CSS, JavaScript bundles

### Code Splitting

```typescript
// Lazy load heavy components
const HeavyComponent = lazy(() => 
  import('@/components/HeavyComponent')
);

// Route-based splitting
const AdminDashboard = lazy(() => 
  import('@/pages/admin/dashboard')
);
```

## Development Guidelines

### Git Workflow

1. **Branch Naming**: `feature/description`, `fix/issue-number`
2. **Commit Messages**: Conventional commits format
3. **Pull Requests**: Required reviews, passing tests
4. **Main Branch**: Protected, requires PR approval

### Code Quality Standards

- **ESLint**: Strict configuration with custom rules
- **Prettier**: Consistent formatting
- **TypeScript**: Strict mode enabled
- **Pre-commit Hooks**: Lint, format, type-check
- **Code Reviews**: Required for all changes

### Component Development

1. **Start with Types**: Define interfaces first
2. **Write Tests**: Test-driven development
3. **Document Props**: JSDoc comments
4. **Optimize Renders**: Use memo, useMemo, useCallback
5. **Handle Errors**: Proper error boundaries

### API Development

1. **Design First**: OpenAPI specification
2. **Validate Input**: Zod schemas
3. **Standardize Responses**: Consistent format
4. **Document Endpoints**: Swagger/OpenAPI
5. **Version APIs**: Semantic versioning

## Testing Strategy

### Test Types

- **Unit Tests**: Components, hooks, utilities
- **Integration Tests**: API endpoints, services
- **E2E Tests**: Critical user journeys
- **Performance Tests**: Load testing, benchmarks

### Test Structure

```typescript
// __tests__/components/Component.test.tsx
describe('Component', () => {
  it('should render correctly', () => {
    const { getByText } = render(<Component />);
    expect(getByText('Expected Text')).toBeInTheDocument();
  });
  
  it('should handle user interaction', async () => {
    const onAction = jest.fn();
    const { getByRole } = render(<Component onAction={onAction} />);
    
    await userEvent.click(getByRole('button'));
    expect(onAction).toHaveBeenCalledWith(expectedData);
  });
});
```

## Deployment Architecture

### Environment Configuration

- **Development**: Local PostgreSQL, test Stripe
- **Staging**: Mirrors production, test data
- **Production**: DigitalOcean Sydney region

### CI/CD Pipeline

1. **Code Push** → GitHub Actions triggered
2. **Tests Run** → Unit, integration, lint
3. **Build** → Next.js production build
4. **Deploy** → DigitalOcean App Platform
5. **Health Check** → Verify deployment
6. **Rollback** → Automatic on failure

### Monitoring

- **Application**: Sentry for error tracking
- **Performance**: Custom metrics dashboard
- **Database**: Query performance monitoring
- **Infrastructure**: DigitalOcean monitoring

## Future Considerations

### Scalability

- Implement horizontal scaling for API servers
- Add read replicas for database
- Implement event-driven architecture
- Consider microservices for heavy processing

### Maintainability

- Regular dependency updates
- Automated security scanning
- Performance regression testing
- Documentation updates with code changes

### Compliance

- Regular security audits
- Australian privacy law compliance
- Tax regulation updates
- Data retention policies

---

This architecture documentation should be updated as the system evolves. All architectural decisions should be documented in ADRs (Architecture Decision Records) in the `docs/adr/` directory.