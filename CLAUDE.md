# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ SECURITY NOTICE

**IMPORTANT**: This file should NEVER contain actual credentials, API keys, passwords, or any sensitive information. All sensitive values must be stored in environment variables and referenced using placeholders like `[STORED IN ENVIRONMENT VARIABLES]` in this documentation.

# TAAXDOG PROJECT CONFIGURATION

## Project Identity
- Project Name: Taaxdog-coding
- Domain: taxreturnpro.com.au
- Framework: Next.js 15.3.4 with TypeScript and React 19
- Database: PostgreSQL on DigitalOcean Sydney
- Deployment: DigitalOcean App Platform (Sydney region)

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
npm run build:production   # Full production build with scripts
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

### 2. AI Service Integration
- **Location**: `lib/ai/`, `pages/api/ai/`
- **Architecture**: Multi-provider with fallback (Anthropic → OpenRouter → Gemini)
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
- **Architecture**: Prisma ORM with PostgreSQL
- **Key Patterns**:
  - Singleton pattern for Prisma client
  - Connection pooling optimization
  - Query performance monitoring
  - Environment-aware logging
  - Health checks with metrics

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

1. **Hybrid Architecture**: Next.js for frontend/lightweight APIs, Flask for heavy processing
2. **Multi-Provider Strategy**: Fallback providers for AI and banking services
3. **Event-Driven Updates**: Webhooks for real-time state synchronization
4. **Security-First**: Multiple authentication/authorization layers
5. **Cost Optimization**: AI response caching, token tracking
6. **Australian-First Design**: All features comply with Australian regulations

## Common Development Tasks

### Adding a New API Endpoint
1. Create route in `pages/api/`
2. Apply appropriate middleware wrapper (withAuth, withRateLimit, etc.)
3. Add input validation
4. Implement business logic
5. Add audit logging for sensitive operations

### Working with AI Services
1. Use `AIService` from `lib/ai/service.ts`
2. Select appropriate operation type
3. Handle provider fallback gracefully
4. Track token usage for cost monitoring

### Database Schema Changes
1. Update `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Create migration: `npx prisma migrate dev`
4. Test with `npm run test-db`
5. Update any affected TypeScript types

### Implementing Australian Tax Features
1. Always use Australian tax year (July 1 - June 30)
2. Include GST in all calculations (10%)
3. Use ATO-compliant categories (D1-D15, P8)
4. Validate ABN format when collected
5. Generate proper tax invoices with all required fields

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

1. Ensure on main branch: `git branch --show-current`
2. Run validation: `npm run deploy:validate`
3. Commit changes: `git add . && git commit -m "your message"`
4. Push to trigger auto-deploy: `git push origin main`
5. Monitor at: https://cloud.digitalocean.com/apps

**Important**: Use `app.yaml` for deployment configuration, NOT `digitalocean-app-spec.yaml`