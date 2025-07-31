# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ SECURITY NOTICE

**IMPORTANT**: This file should NEVER contain actual credentials, API keys, passwords, or any sensitive information. All sensitive values must be stored in environment variables and referenced using placeholders like `[STORED IN ENVIRONMENT VARIABLES]` in this documentation.

## 🔒 CRITICAL: Authentication System Protection

### DO NOT MODIFY WITHOUT THOROUGH REVIEW:
The authentication system has been carefully implemented and tested. These components MUST NOT be changed without understanding the full impact:

1. **Password Hashing**: MUST use bcrypt with 12 rounds
   - File: All registration and password change endpoints
   - Pattern: `bcrypt.hash(password, 12)`
   
2. **Password Reset Tokens**: MUST use SHA256 hashing (NOT bcrypt!)
   - Files: `/pages/api/auth/forgot-password.ts`, `/pages/api/auth/simple-forgot-password.ts`, `/pages/api/auth/reset-password.ts`
   - Pattern: `crypto.createHash('sha256').update(token).digest('hex')`
   
3. **Token Storage**: MUST use user table fields
   - Fields: `user.passwordResetToken`, `user.passwordResetExpires`
   - NOT a separate passwordResetToken table
   
4. **Account Locking**: After 4 failed attempts = 15 minute lock
   - File: `/lib/auth.ts`
   - Constants: `MAX_FAILED_ATTEMPTS = 4`, `ACCOUNT_LOCK_DURATION_MINUTES = 15`
   
5. **Rate Limiting**: All auth endpoints must have rate limiting
   - File: `/lib/security/rateLimiter.ts`
   - MUST have try-catch blocks for response methods

### Common Authentication Mistakes to Avoid:
- ❌ Do NOT change hashing algorithms
- ❌ Do NOT use bcrypt for reset tokens (breaks the system)
- ❌ Do NOT move token storage to different tables
- ❌ Do NOT remove or bypass rate limiting
- ❌ Do NOT change bcrypt rounds from 12
- ❌ Do NOT modify account locking thresholds

### Authentication Flow Summary:
1. **Registration**: Email → Validate → Hash with bcrypt(12) → Store
2. **Login**: Email/Pass → Rate limit → Check lock → Verify with bcrypt → Session
3. **Forgot Password**: Email → Generate token → Hash with SHA256 → Store in user table
4. **Reset Password**: Token → Hash with SHA256 → Find user → Update password with bcrypt(12)

For detailed documentation, see `/docs/AUTHENTICATION_SYSTEM.md`

# TAAXDOG PROJECT CONFIGURATION

## Project Identity
- Project Name: Taaxdog (TaxReturnPro)
- Domain: taxreturnpro.com.au
- Framework: Next.js 14.0.4 with TypeScript and React 18.2
- Database: PostgreSQL with Prisma ORM (migrated from Firebase)
- Deployment: DigitalOcean App Platform (Sydney region)
- Containerization: Docker with multi-stage optimized builds

## Core Development Commands

### Essential Commands
```bash
npm run dev                # Start development server (http://localhost:3000)
npm run build              # Build for production with Prisma generation
npm run start              # Start production server
npm run lint               # Run ESLint with Next.js configuration
npm run type-check         # Run TypeScript type checking (tsc --noEmit)
```

### Database Commands
```bash
npm run db:generate        # Generate Prisma client
npm run db:push            # Push schema changes to database (without migrations)
npm run db:migrate         # Run database migrations in development
npm run db:seed            # Seed database with initial data
npm run db:studio          # Open Prisma Studio GUI
npm run db:reset           # Reset database (drops all data)
npm run setup              # Run automated database setup script
```

### Testing Commands
```bash
npm test                   # Run all Jest tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report (70% threshold)
npm run test:ci            # Run tests in CI mode with coverage
npm test [filename]        # Run specific test file
```

### Deployment
```bash
npm run deploy             # Run deployment script (scripts/deploy.sh)
npm run postinstall        # Auto-runs after npm install (generates Prisma client)
```

## High-Level Architecture

### 1. Authentication Architecture (NextAuth.js v4.24.5)
- **Location**: `src/app/api/auth/[...nextauth]/route.ts`, `lib/auth.ts`
- **Strategy**: JWT sessions (not database sessions)
- **Providers**: Credentials (email/password) + Google OAuth (ready but not configured)
- **Key Patterns**:
  - Role-based access (USER, ADMIN, ACCOUNTANT, SUPPORT)
  - Middleware composition in `lib/auth/middleware.ts`
  - Account locking and suspicious activity tracking
  - Email verification requirements
  - Enhanced password reset flow with SendGrid integration
  - Session validation uses `getServerSession` with authOptions
  - App Router compatible with route handlers

### 2. AI Service Integration
- **Location**: `lib/ai/`, `src/app/api/ai/`
- **Architecture**: Multi-provider with fallback (Anthropic → OpenRouter → Gemini)
- **Key Patterns**:
  - Operation-based model selection (TAX_ANALYSIS, RECEIPT_SCANNING, etc.)
  - 24-hour response caching in database
  - Rate limiting per provider with in-memory store
  - Australian tax context in system prompts
  - Token usage tracking and cost calculation
  - Automatic retry with provider fallback on failure
  - OpenAI API integration for receipt processing

### 3. Banking Integration (BASIQ)
- **Location**: `lib/basiq/`, `src/app/api/banking/`
- **Flow**: Consent → Connection → Account Sync → Transaction Sync
- **Key Patterns**:
  - OAuth token management with auto-refresh
  - Webhook-based real-time updates
  - Automatic GST calculation (10%)
  - Tax category mapping (D1-D15, P8)
  - Batch sync with pagination (500 transactions per page)
  - Transaction categorization based on merchant and description

### 4. Database Access Patterns
- **Location**: `lib/db/`, `prisma/`
- **Architecture**: Prisma ORM v5.7.1 with PostgreSQL
- **Key Patterns**:
  - Singleton pattern for Prisma client in `lib/prisma.ts`
  - Connection pooling optimization
  - Query performance monitoring
  - Row-Level Security (RLS) implementation
  - Field-level encryption for sensitive data (AES-256-GCM)
  - 6 critical performance indexes added for optimization
  - Seed script uses ts-node with custom tsconfig

### 5. Security Middleware Stack
- **Location**: `lib/middleware/`
- **Layers** (applied in order):
  1. Security headers
  2. Authentication validation
  3. Authorization (role-based)
  4. CSRF protection (for state-changing operations)
  5. Input validation/sanitization
  6. Rate limiting (configurable per endpoint)
- **Usage**: `withMiddleware` composable pattern or `withSecurity` wrapper

### 6. API Response Patterns
- **Location**: `lib/api/response.ts`
- **Standard format**: `{ success: boolean, data?: any, error?: string }`
- **Error codes**: Consistent across all endpoints
- **Pagination**: `{ items: [], total: number, page: number, pageSize: number }`

#### Error Handling Pattern (App Router)
```typescript
// App Router API route handler pattern
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Business logic
    const result = await someOperation();
    
    // Return success
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// For POST/PUT/DELETE methods
export async function POST(request: NextRequest) {
  const body = await request.json();
  // Similar pattern...
}
```

### 7. Subscription/Payment Flow (Stripe)
- **Location**: `lib/stripe/`, `src/app/api/stripe/`
- **Plans**:
  - TAAX Smart: 3-day trial → $4.99/mo (2 months) → $9.99/mo
  - TAAX Pro: 7-day trial → $10.99/mo (2 months) → $18.99/mo
- **Key Patterns**:
  - Webhook-based lifecycle management
  - Australian GST compliance (10% included)
  - Tax invoice generation
  - Failed payment retry logic

## Australian Compliance Requirements (NON-NEGOTIABLE)
- ATO compliance for all tax calculations
- GST handling at 10% rate (included in prices)
- Data residency in Australian datacenters only
- Australian Privacy Principles (APPs) compliance
- Australian Consumer Law compliance for subscriptions
- Tax invoice generation meeting ATO standards
- ABN validation and handling
- Australian tax year handling (July 1 - June 30)
- State/territory support for all Australian regions

## Critical Architectural Decisions

1. **Unified Architecture**: Next.js App Router for both frontend and API (migrated from hybrid Flask/Next.js)
2. **Multi-Provider Strategy**: Fallback providers for AI and banking services
3. **Event-Driven Updates**: Webhooks for real-time state synchronization
4. **Security-First**: Multiple authentication/authorization layers
5. **Cost Optimization**: AI response caching, token tracking
6. **Australian-First Design**: All features comply with Australian regulations

## Next.js Configuration Details
- **App Router**: Using experimental App Router (not Pages Router)
- **Runtime**: Node.js 18+ required
- **Image Optimization**: Disabled in development
- **TypeScript**: Strict mode enabled with custom paths
- **Bundle Optimization**: Custom webpack config with polyfills for DigitalOcean
- **Middleware**: Edge runtime for auth and security checks
- **Cookie Security**: Overrides cookie package to v0.7.2 for security

## UI Component Stack
- **Base UI**: Tailwind CSS v3.4.0 with Tailwind Forms plugin
- **Component Libraries**: 
  - Headless UI v1.7.17 for accessible components
  - Heroicons v2.0.18 for icons
  - Lucide React v0.294.0 for additional icons
- **Utility Classes**: clsx v2.0.0 + tailwind-merge v2.2.0
- **Notifications**: React Hot Toast v2.4.1
- **Cookie Management**: js-cookie v3.0.5

## Common Development Tasks

### Project Structure (App Router)
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authenticated routes group
│   │   ├── dashboard/     # Dashboard page
│   │   ├── banking/       # Banking features
│   │   ├── goals/         # Financial goals
│   │   └── ...           
│   ├── api/               # API route handlers
│   │   ├── auth/         # Authentication endpoints
│   │   ├── banking/      # Banking API
│   │   └── ...
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # Reusable components
│   ├── ui/              # Base UI components
│   └── forms/           # Form components
└── lib/                 # Utilities and services
    ├── auth.ts          # Auth utilities
    ├── ai/              # AI service integration
    ├── basiq/           # Banking integration
    └── db/              # Database utilities
```

### Adding a New API Endpoint
1. Create route handler in `src/app/api/[endpoint]/route.ts`
2. Apply appropriate middleware wrapper:
   - `withAuth()` for authenticated endpoints
   - `withRateLimit()` for rate-limited endpoints
   - `withSecurity()` for full security stack
3. Add input validation using Zod schemas from `lib/validation/api-schemas.ts`
4. Use standardized response format from `lib/api/response.ts`
5. Implement business logic
6. Add audit logging for sensitive operations
7. Write tests for the new endpoint

### Working with AI Services
1. Use `aiService` singleton from `lib/ai/service.ts`
2. Select appropriate operation type from `AIOperationType` enum
3. Check for cached response first
4. Handle provider fallback gracefully
5. Track token usage for cost monitoring

#### AI Provider Hierarchy & Failover
```typescript
// Provider selection logic in lib/ai/service.ts
1. Anthropic (Claude) - Primary for tax/financial analysis
2. OpenRouter - Fallback with Claude 3.5 Sonnet
3. Gemini - Receipt OCR and document processing

// Operation types determine model selection
AIOperationType.TAX_ANALYSIS → Claude 4 Sonnet
AIOperationType.RECEIPT_SCANNING → Gemini Pro Vision
AIOperationType.GENERAL_QUERY → Claude 3.5 Sonnet (cost-optimized)
```

#### AI Response Caching
- Responses cached for 24 hours in `aiResponseCache` table
- Cache key: SHA256 hash of (operation + prompt + userId)
- Automatic cache invalidation on user data changes

### Database Schema Changes
1. Update `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Create migration: `npx prisma migrate dev --name descriptive_name`
4. Test with `npm run test-db`
5. Update any affected TypeScript types
6. Consider performance indexes for new fields
7. Update relevant API schemas and tests

#### Prisma Client Patterns
```typescript
// ALWAYS use the singleton from lib/prisma.ts
import { prisma } from '@/lib/prisma';

// NEVER import from @prisma/client directly
// ❌ import { PrismaClient } from '@prisma/client';

// Transaction pattern for multiple operations
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.update({...});
  const audit = await tx.auditLog.create({...});
  return { user, audit };
});

// Always include userId in queries for RLS
const items = await prisma.transaction.findMany({
  where: { userId: session.user.id }
});
```

#### Database Performance Considerations
- Use `select` to limit fields returned
- Implement pagination for large datasets (default: 50 items)
- Use indexes for frequently queried fields
- Monitor slow queries in `logs/slow-queries.log`

### Implementing Australian Tax Features
1. Use Australian tax year (July 1 - June 30) from `date-fns-tz`
2. Include GST in all calculations (10%)
3. Use ATO-compliant categories (D1-D15, P8) from `TAX_CATEGORIES`
4. Validate ABN format when collected
5. Generate proper tax invoices with all required fields

### Working with React Query
1. Use custom hooks from `hooks/queries/`
2. Query keys follow pattern: `['resource', id, params]`
3. Implement optimistic updates for better UX
4. Use proper cache invalidation strategies
5. Handle loading and error states with UI components

## Environment Variables

Critical variables that must be set:
- DATABASE_URL - PostgreSQL connection string
- NEXTAUTH_URL - Application URL
- NEXTAUTH_SECRET - NextAuth secret (min 32 chars)
- ANTHROPIC_API_KEY - For AI features
- STRIPE_SECRET_KEY - Payment processing
- BASIQ_API_KEY - Banking integration
- FIELD_ENCRYPTION_KEY - Data encryption
- OPENAI_API_KEY - AI receipt processing
- EMAIL_SERVER_* - Email configuration

Additional configuration:
- BCRYPT_ROUNDS=12 - Password hashing rounds
- RATE_LIMIT_MAX=100 - Rate limit requests
- RATE_LIMIT_WINDOW=900000 - 15 minutes
- UPLOAD_MAX_SIZE=10485760 - 10MB file limit

See `.env.example` for complete list with descriptions.

## Demo Account
After running database seed (`npm run db:seed`), use these credentials:
- **Email**: demo@taxreturnpro.com.au
- **Password**: demo123

## Deployment Process

### Cloud Deployment (DigitalOcean)
1. Ensure on main branch: `git branch --show-current`
2. Run validation: `npm run deploy:validate`
3. Run tests: `npm test -- --coverage`
4. Commit changes: `git add . && git commit -m "your message"`
5. Push to trigger auto-deploy: `git push origin main`
6. Monitor at: https://cloud.digitalocean.com/apps

**Important**: Use `app.yaml` for deployment configuration, NOT `digitalocean-app-spec.yaml`

## Project Configuration Notes

### Build Configuration
- TypeScript errors are ignored during production builds for faster deployment
- ESLint warnings don't block builds
- Custom webpack configuration with code splitting
- Bundle optimization with compression plugin
- SWC minification enabled

### Performance Optimization
- React Query for data fetching with 5-minute cache
- Dynamic imports for heavy components (insights, receipts, charts)
- Lazy loading utilities in `lib/utils/dynamic-import.tsx`
- Web Vitals monitoring integrated with Sentry
- Database query optimization with materialized views

### Testing Infrastructure
- **Framework**: Jest 29.7 with TypeScript support
- **Component Testing**: React Testing Library with custom test utilities
- **Test Structure**:
  - Unit tests: Colocated with source files (`*.test.ts`, `*.test.tsx`)
  - Integration tests: `__tests__/integration/`
  - E2E tests: Playwright setup available
  - Mock files: `__mocks__/` directory
- **Coverage Requirements**: 70% threshold for all metrics (statements, branches, functions, lines)
- **Test Setup**: 
  - Global mocks in `jest.setup.js` (NextAuth, router, fetch)
  - Custom matchers and utilities
  - Module path aliases matching tsconfig
- **Running Tests**:
  ```bash
  npm test                    # Run all tests
  npm run test:watch         # Watch mode
  npm run test:coverage      # Coverage report
  npm test ComponentName     # Test specific file/pattern
  ```

## Quick Troubleshooting

### Common Issues
- **TypeScript errors**: Run `npm run type-check` and fix any type issues
- **Database connection**: Check DATABASE_URL and run `npm run test-db`
- **Build failures**: Clear `.next` directory and run `npm run build`
- **Test failures**: Clear Jest cache with `npm test -- --clearCache`
- **Docker issues**: Run `docker-compose build --no-cache`

### Performance Issues
- Check bundle size: `npm run analyze-bundle`
- Review database queries: `npm run test:db-performance`
- Monitor with Sentry dashboard
- Check for memory leaks in long-running operations

## Running Single Tests
```bash
# Run a specific test file
npm test path/to/test.spec.ts

# Run tests in watch mode for a specific file
npm test -- --watch path/to/test.spec.ts

# Run integration tests only
npm run test:integration

# Run E2E tests with Playwright
npx playwright test path/to/test.spec.ts
```

## Flask Backend Integration
While the project structure includes a `backend/` directory with Flask services, the primary application has been migrated to use Next.js API routes for all functionality. The Flask backend components exist for reference but are not actively used in production:

- **Location**: `backend/` directory (legacy code)
- **Original Purpose**: Heavy processing tasks (receipt processing, ML analytics)
- **Current Status**: Functionality migrated to Next.js API routes
- **Key Services Migrated**:
  - Receipt processing → `src/app/api/receipts/`
  - AI/ML analytics → `lib/ai/` and `src/app/api/ai/`
  - Automated reports → Next.js API routes with cron jobs
- **Database**: All services use the same PostgreSQL database

## Deployment-Specific Patterns

### Production Build Process
```bash
# Standard production build
npm run build

# DigitalOcean deployment build (includes polyfills)
npm run build:do
```

### Environment-Specific Considerations
- **Development**: Uses local PostgreSQL or DigitalOcean dev database
- **Production**: DigitalOcean Managed PostgreSQL with SSL required
- **Docker**: Multi-stage build with optimized layers (`Dockerfile.optimized`)
- **Deployment Config**: Use `app.yaml`, NOT `digitalocean-app-spec.yaml`

### Pre-deployment Checklist
1. Run `npm run deploy:validate` - Comprehensive validation
2. Ensure all tests pass: `npm test -- --coverage`
3. Check TypeScript: `npm run type-check`
4. Verify environment variables are set in DigitalOcean
5. Database migrations applied: `npm run db:migrate`

## API Endpoints Reference

### Authentication (`/api/auth/`)
- `POST /api/auth/signin` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Financial Data (`/api/`)
- `GET /api/dashboard` - Dashboard overview
- `GET /api/banking/accounts` - List bank accounts
- `GET /api/goals` - Get financial goals
- `GET /api/financial/net-income` - Income summary
- `GET /api/financial/total-expenses` - Expense summary

### User Management (`/api/`)
- `GET /api/tax/profile` - Get tax profile
- `PUT /api/tax/profile` - Update tax profile
- `GET /api/user/settings` - Get user settings
- `PUT /api/user/settings` - Update user settings

### Banking Integration (`/api/banking/`)
- `POST /api/banking/connect` - Connect bank account
- `GET /api/banking/transactions` - Get transactions
- `POST /api/banking/sync` - Sync bank data

### AI Features (`/api/ai/`)
- `POST /api/ai/analyze-receipt` - Analyze receipt
- `POST /api/ai/tax-advice` - Get tax advice
- `POST /api/ai/categorize` - Auto-categorize transactions