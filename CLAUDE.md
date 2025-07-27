# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ SECURITY NOTICE

**IMPORTANT**: This file should NEVER contain actual credentials, API keys, passwords, or any sensitive information. All sensitive values must be stored in environment variables and referenced using placeholders like `[STORED IN ENVIRONMENT VARIABLES]` in this documentation.

# TAAXDOG PROJECT CONFIGURATION

## Project Identity
- Project Name: Taaxdog-coding
- Domain: taxreturnpro.com.au
- Framework: Next.js 15.3.4 with TypeScript and React 19
- Database: PostgreSQL with Prisma ORM (migrated from Firebase)
- Deployment: DigitalOcean App Platform (Sydney region)
- Containerization: Docker with multi-stage optimized builds

## Infrastructure Details

### Droplets

- Production Droplet: taxreturnpro-droplet (IP: 170.64.206.137)
- Staging Droplet: taxreturnpro-staging-droplet (IP: 170.64.195.235)

### Database Configuration

#### Development Database

DATABASE_URL="postgresql://[username]@localhost:5432/taaxdog_development"

#### Production Database

- Host: taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com
- Port: 25060 (main) / 25061 (application)
- Database: taaxdog-production
- SSL Mode: require
- Connection Pool: taaxdog-connection-pool

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

### Testing & Verification

```bash
npm test                   # Run all Jest tests
npm test -- --coverage     # Run tests with coverage report (80%+ target)
npm test -- --watch        # Run tests in watch mode
npm test [filename]        # Run specific test file
npm run test:integration   # Run integration tests only
npm run test:api           # Test API endpoints
npm run test:db-performance # Test database performance
npm run test:security      # Run security tests
npm run test-auth          # Test authentication system
npm run test-ai            # Test AI service integrations
npm run test-basiq         # Test banking integration
npm run verify:quick       # Quick system verification
npm run verify:full        # Comprehensive migration verification
npm run verify:compliance  # Check Australian compliance
npm run security:validate  # Security validation
npm run env:validate       # Environment validation
```

### Deployment

```bash
npm run deploy:validate    # Run deployment checklist
npm run deploy:check:env   # Validate environment
npm run deploy:check:security  # Security checklist
npm run deploy:check:golive    # Go-live validation
```

### Monitoring & Maintenance

```bash
npm run monitoring:setup   # Setup performance monitoring
npm run compliance:all     # Run all compliance checks
npm run backup:full        # Full database backup
npm run audit:verify       # Verify audit logs
npm run optimize:queries   # Optimize database queries
npm run monitor:resources  # Monitor system resources
npm run backup:incremental # Incremental backup
npm run audit:maintain     # Cleanup old audit logs
npm run analyze-bundle     # Analyze bundle size with webpack
npm run optimization:report # Generate optimization report
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

### 2. AI Service Integration

- **Location**: `lib/ai/`, `pages/api/ai/`
- **Architecture**: Multi-provider with fallback (Anthropic → OpenRouter →
  Gemini)
- **Key Patterns**:
  - Operation-based model selection (TAX_ANALYSIS, RECEIPT_SCANNING, etc.)
  - 24-hour response caching
  - Rate limiting per provider
  - Australian tax context in system prompts
  - Token usage tracking and cost calculation

### 3. Banking Integration (BASIQ)

- **Location**: `lib/basiq/`, `pages/api/banking/`
- **Flow**: Consent → Connection → Account Sync → Transaction Sync
- **Key Patterns**:
  - OAuth token management with auto-refresh
  - Webhook-based real-time updates
  - Automatic GST calculation (10%)
  - Tax category mapping (D1-D15, P8)
  - Batch sync with pagination

### 4. Database Access Patterns

- **Location**: `lib/db/`, `prisma/`
- **Architecture**: Prisma ORM with PostgreSQL (migrated from Firebase)
- **Key Patterns**:
  - Singleton pattern for Prisma client in `lib/prisma.ts`
  - Connection pooling optimization
  - Query performance monitoring
  - Environment-aware logging
  - Health checks with metrics
  - 6 critical performance indexes added for optimization
  - Row-Level Security (RLS) implementation

### 5. Security Middleware Stack

- **Location**: `lib/middleware/`
- **Layers**:
  1. Authentication validation
  2. Authorization (role-based)
  3. Rate limiting (configurable per endpoint)
  4. CSRF protection
  5. Input validation/sanitization
  6. Security headers
- **Usage**: `withMiddleware` composable pattern

### 6. Python Flask Backend

- **Location**: `backend/`
- **Purpose**: Heavy processing, ML tasks, background jobs
- **Integration**: RESTful API with correlation IDs
- **Key Services**:
  - Transfer scheduler
  - Savings advisor
  - Receipt processing pipeline
  - Analytics engine

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

1. **Hybrid Architecture**: Next.js for frontend/lightweight APIs, Flask for
   heavy processing
2. **Multi-Provider Strategy**: Fallback providers for AI and banking services
3. **Event-Driven Updates**: Webhooks for real-time state synchronization
4. **Security-First**: Multiple authentication/authorization layers
5. **Cost Optimization**: AI response caching, token tracking
6. **Australian-First Design**: All features comply with Australian regulations

## Key Technical Patterns

### Error Handling

- Consistent error response format with error codes
- Comprehensive logging with correlation IDs
- User-friendly error messages with actionable steps
- Automatic error reporting for critical failures

### Performance Optimization

- Redis caching for frequently accessed data
- Materialized views for analytics queries
- Connection pooling with pgbouncer
- Query optimization with Prisma's `explain`
- Lazy loading and code splitting

### Testing Strategy

- Component-specific test scripts (`test-auth`, `test-ai`, etc.)
- Environment validation before deployment
- Compliance verification suite
- Performance monitoring with alerts

## Common Development Tasks

### Adding a New API Endpoint

1. Create route in `pages/api/`
2. Apply appropriate middleware wrapper (withAuth, withRateLimit, etc.)
3. Add input validation using Zod schemas from `lib/validation/api-schemas.ts`
4. Use standardized response format from `lib/api/response.ts`
5. Implement business logic
6. Add audit logging for sensitive operations
7. Write tests for the new endpoint

### Working with AI Services

1. Use `AIService` from `lib/ai/service.ts`
2. Select appropriate operation type
3. Handle provider fallback gracefully
4. Track token usage for cost monitoring
5. Implement caching for expensive operations

### Database Schema Changes

1. Update `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Create migration: `npx prisma migrate dev --name descriptive_name`
4. Test with `npm run test-db`
5. Update any affected TypeScript types
6. Consider performance indexes for new fields
7. Update relevant API schemas and tests

### Implementing Australian Tax Features

1. Always use Australian tax year (July 1 - June 30)
2. Include GST in all calculations (10%)
3. Use ATO-compliant categories (D1-D15, P8)
4. Validate ABN format when collected
5. Generate proper tax invoices with all required fields

### Working with React Query

1. Use custom hooks from `hooks/queries/`
2. Follow consistent query key patterns
3. Implement optimistic updates for better UX
4. Use proper cache invalidation strategies
5. Handle loading and error states appropriately

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

### Environment Management

```bash
npm run env:switch:dev     # Switch to development environment
npm run env:switch:staging # Switch to staging environment
npm run env:switch:prod    # Switch to production environment
npm run env:backup         # Backup current environment
```

## Deployment Process

### Local Deployment with Docker
```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up

# Rebuild containers
docker-compose build --no-cache
```

### Cloud Deployment
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
- Custom webpack configuration ignores RLS-migrated files
- Separate TypeScript configs for app (`tsconfig.json`) and scripts
  (`tsconfig.node.json`)
- Bundle optimization with code splitting and lazy loading
- SWC minification enabled for smaller builds
- Compression plugin for gzip assets in production

### Performance Optimization

- React Query for optimized data fetching with caching
- Dynamic imports for heavy components (insights, receipts, charts)
- Lazy loading utilities in `lib/utils/dynamic-import.tsx`
- Bundle analyzer available via `npm run analyze-bundle`
- Web Vitals monitoring integrated with Sentry

### Testing Infrastructure

- Jest configured with TypeScript support
- React Testing Library for component tests
- Test files use `.test.ts` or `.test.tsx` extension
- Mock files in `__mocks__/` directory
- Coverage reports via `npm test -- --coverage`

## Recent Architecture Improvements

### API Response Standardization

- All API routes use `lib/api/response.ts` utilities
- Consistent error handling and response formats
- TypeScript types for all API responses

### Code Quality Tools

- ESLint with custom rules for consistency
- Prettier for code formatting
- TypeScript strict mode enabled
- Automated scripts for fixing common issues (`fix:naming`, `fix:console`)

### Bundle Size Optimization

- Webpack configuration with advanced code splitting
- Separate chunks for framework, libraries, and common code
- Dynamic import patterns for lazy loading
- Performance budgets defined in `lib/config/bundle-optimization.ts`

### Security Configuration

- Comprehensive security headers in `next.config.js`
- Field-level encryption for sensitive data (AES-256-GCM)
- Row-Level Security (RLS) enforced in PostgreSQL
- CSRF protection on all state-changing endpoints
- Rate limiting configured per endpoint and provider

### Monitoring & Logging

- Application performance monitoring in `lib/monitoring/`
- Database query monitoring with performance metrics
- Resource usage tracking (CPU, memory, connections)
- Correlation IDs for request tracing
- Audit logging for all sensitive operations
- Sentry integration for error tracking and performance monitoring
- Web Vitals tracking for client-side performance

## Docker Configuration

- Multi-stage Dockerfile for optimized builds (200MB vs 1.5GB)
- Separate development and production configurations
- Health checks for all services
- Redis for caching and session storage
- Nginx for load balancing and reverse proxy
- Prometheus and Grafana for metrics

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

# important-instruction-reminders

Do what has been asked; nothing more, nothing less. NEVER create files unless they're absolutely necessary for achieving your goal. ALWAYS prefer editing an existing file to creating a new one. NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
