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
- Project Name: Taaxdog-coding
- Domain: taxreturnpro.com.au
- Framework: Next.js 15.3.4 with TypeScript and React 19
- Database: PostgreSQL with Prisma ORM (migrated from Firebase)
- Deployment: DigitalOcean App Platform (Sydney region)
- Containerization: Docker with multi-stage optimized builds

## Core Development Commands

### Essential Commands
```bash
npm run dev                # Start development server (http://localhost:3000)
npm run build              # Build for production with Prisma generation
npm run start              # Start production server
npm run lint               # Run ESLint
npm run lint:fix           # Fix ESLint issues automatically
npm run type-check         # Run TypeScript type checking
npm run quality:check      # Run all code quality checks
npm run fix:all            # Fix naming, console statements, lint, and format
```

### Database Commands
```bash
npm run migrate            # Run database migrations
npm run test-db            # Test database connection
npx prisma generate        # Generate Prisma client
npx prisma db push         # Push schema changes to database
npx prisma studio          # Open Prisma Studio GUI
npm run db:import          # Import data using optimized orchestrator
```

### Testing Commands
```bash
npm test                   # Run all Jest tests
npm test -- --coverage     # Run tests with coverage report (80%+ target)
npm test -- --watch        # Run tests in watch mode
npm test [filename]        # Run specific test file
npm run test:integration   # Run integration tests only
npm run test:api           # Test API endpoints
npm run test:db-performance # Test database performance
npm run test:security      # Run security tests
```

### Deployment & Monitoring
```bash
npm run deploy:validate    # Run deployment checklist
npm run compliance:all     # Run all compliance checks
npm run backup:full        # Full database backup
npm run analyze-bundle     # Analyze bundle size with webpack
npm run monitoring:setup   # Setup performance monitoring
```

### Environment Management
```bash
npm run env:dev            # Switch to development environment
npm run env:staging        # Switch to staging environment  
npm run env:prod           # Switch to production environment
npm run env:status         # Check current environment
npm run env:validate       # Environment validation
```

## High-Level Architecture

### 1. Authentication Architecture (NextAuth.js)
- **Location**: `pages/api/auth/[...nextauth].ts`, `lib/auth/`
- **Strategy**: JWT sessions (not database sessions)
- **Providers**: Credentials (email/password) + Google OAuth
- **Key Patterns**:
  - Role-based access (USER, ADMIN, ACCOUNTANT, SUPPORT)
  - Middleware composition in `lib/auth/middleware.ts`
  - Account locking and suspicious activity tracking
  - Email verification requirements
  - Enhanced password reset flow with SendGrid integration
  - Session validation uses `getServerSession` with authOptions

### 2. AI Service Integration
- **Location**: `lib/ai/`, `pages/api/ai/`
- **Architecture**: Multi-provider with fallback (Anthropic → OpenRouter → Gemini)
- **Key Patterns**:
  - Operation-based model selection (TAX_ANALYSIS, RECEIPT_SCANNING, etc.)
  - 24-hour response caching in database
  - Rate limiting per provider with in-memory store
  - Australian tax context in system prompts
  - Token usage tracking and cost calculation
  - Automatic retry with provider fallback on failure

### 3. Banking Integration (BASIQ)
- **Location**: `lib/basiq/`, `pages/api/banking/`
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
- **Architecture**: Prisma ORM with PostgreSQL (migrated from Firebase)
- **Key Patterns**:
  - Singleton pattern for Prisma client in `lib/prisma.ts`
  - Connection pooling optimization
  - Query performance monitoring
  - Row-Level Security (RLS) implementation
  - Field-level encryption for sensitive data (AES-256-GCM)
  - 6 critical performance indexes added for optimization

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

### 7. Subscription/Payment Flow (Stripe)
- **Location**: `lib/stripe/`, `pages/api/stripe/`
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

## Critical Architectural Decisions

1. **Hybrid Architecture**: Next.js for frontend/lightweight APIs, Flask for heavy processing
2. **Multi-Provider Strategy**: Fallback providers for AI and banking services
3. **Event-Driven Updates**: Webhooks for real-time state synchronization
4. **Security-First**: Multiple authentication/authorization layers
5. **Cost Optimization**: AI response caching, token tracking
6. **Australian-First Design**: All features comply with Australian regulations

## Common Development Tasks

### Adding a New API Endpoint
1. Create route in `pages/api/`
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

### Database Schema Changes
1. Update `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Create migration: `npx prisma migrate dev --name descriptive_name`
4. Test with `npm run test-db`
5. Update any affected TypeScript types
6. Consider performance indexes for new fields
7. Update relevant API schemas and tests

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
- DATABASE_URL
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- ANTHROPIC_API_KEY
- STRIPE_SECRET_KEY
- BASIQ_API_KEY
- FIELD_ENCRYPTION_KEY

See `.env.example` for complete list with descriptions.

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
- Jest with TypeScript support
- React Testing Library for component tests
- Test files: `.test.ts` or `.test.tsx`
- Mock files in `__mocks__/` directory
- Integration tests in `__tests__/integration/`
- Coverage threshold: 70% for all metrics

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