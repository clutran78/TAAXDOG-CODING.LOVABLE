# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ SECURITY NOTICE

**IMPORTANT**: This file should NEVER contain actual credentials, API keys, passwords, or any sensitive information. All sensitive values must be stored in environment variables and referenced using placeholders like `[STORED IN ENVIRONMENT VARIABLES]` in this documentation.

# TAAXDOG PROJECT CONFIGURATION

## Project Identity
- Project Name: Taaxdog-coding
- Domain: taxreturnpro.com.au
- Framework: Next.js 14 with TypeScript
- Database: PostgreSQL on DigitalOcean Sydney
- Deployment: DigitalOcean App Platform (Sydney region)

## Infrastructure Details

### Droplets
- Production Droplet: taxreturnpro-droplet (IP: 170.64.206.137)
- Staging Droplet: taxreturnpro-staging-droplet (IP: 170.64.195.235)
- Droplet Password: [STORED SECURELY IN ENVIRONMENT VARIABLES]

## Database Configuration

### Development Database
DATABASE_URL="postgresql://[username]@localhost:5432/taaxdog_development"

### Production Databases

#### Main Database (Port 25060)
- Username: doadmin
- Password: [STORED IN ENVIRONMENT VARIABLES]
- Host: taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com
- Port: 25060
- Database: defaultdb
- SSL Mode: require

#### Application Database (Port 25061)
- Username: taaxdog-admin
- Password: [STORED IN ENVIRONMENT VARIABLES]
- Host: taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com
- Port: 25061
- Database: taaxdog-production
- SSL Mode: require

#### Connection Pool Database (Port 25061)
- Username: taaxdog-admin
- Password: [STORED IN ENVIRONMENT VARIABLES]
- Host: taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com
- Port: 25061
- Database: taaxdog-connection-pool
- SSL Mode: require

### Connection Strings

#### Public Connection String
DATABASE_URL="postgresql://taaxdog-admin:[PASSWORD]@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require"

#### VPC Connection String
VPC_DATABASE_URL="postgresql://taaxdog-admin:[PASSWORD]@private-taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require"

#### Database Restore Command
PGPASSWORD=[DATABASE_PASSWORD] pg_restore -U doadmin -h taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com -p 25060 -d defaultdb

## Application Configuration

### Development
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[STORED IN ENVIRONMENT VARIABLES]"
NODE_ENV="development"

### Production
NEXTAUTH_URL="https://taxreturnpro.com.au"
NEXTAUTH_SECRET="[STORED IN ENVIRONMENT VARIABLES]"
NODE_ENV="production"

## Stripe Configuration (Live Keys)

STRIPE_PUBLISHABLE_KEY="[STORED IN ENVIRONMENT VARIABLES]"
STRIPE_SECRET_KEY="[STORED IN ENVIRONMENT VARIABLES]"
STRIPE_WEBHOOK_SECRET="[STORED IN ENVIRONMENT VARIABLES]"

## AI Provider Keys

ANTHROPIC_API_KEY="[STORED IN ENVIRONMENT VARIABLES]"
OPENROUTER_API_KEY="[STORED IN ENVIRONMENT VARIABLES]"
GEMINI_API_KEY="[STORED IN ENVIRONMENT VARIABLES]"

## BASIQ Banking Integration

BASIQ_API_KEY="[STORED IN ENVIRONMENT VARIABLES]"

## Subscription Pricing (EXACT REQUIREMENTS)

TAAX Smart Plan:
- Trial: 3 days free
- Promotional: $4.99 AUD/month for first 2 months
- Regular: $9.99 AUD/month after promotional period
- GST: 10% included in all prices

TAAX Pro Plan:
- Trial: 7 days free
- Promotional: $10.99 AUD/month for first 2 months
- Regular: $18.99 AUD/month after promotional period
- GST: 10% included in all prices

## Australian Compliance Requirements (NON-NEGOTIABLE)

- ATO compliance for all tax calculations
- GST handling at 10% rate (included in prices)
- Data residency in Australian datacenters only
- Australian Privacy Principles (APPs) compliance
- Australian Consumer Law compliance for subscriptions
- Tax invoice generation meeting ATO standards
- ABN validation and handling
- Australian tax year handling (July 1 - June 30)

## Technical Requirements

- TypeScript strict mode enabled
- Prisma ORM for database operations
- NextAuth.js for authentication
- Tailwind CSS for styling
- Environment-aware configuration (dev/prod)
- Comprehensive error handling and logging
- Performance optimization for Australian users

## Development Commands

### Core Development
```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database Management
```bash
npm run migrate      # Run database migrations
npm run test-db      # Test database connection
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema changes to database
npx prisma studio    # Open Prisma Studio GUI
```

### Production Build
```bash
npm run build:production  # Full production build with Prisma generation
```

### Database Import/Migration
```bash
npm run db:import              # Import data using optimized orchestrator
npm run postgres:import-batch  # Batch import for large datasets
npm run migration:validate     # Validate migration integrity
npm run migration:rollback     # Rollback migrations
```

### Verification Scripts
```bash
npm run verify:quick       # Quick database verification
npm run verify:full        # Comprehensive migration verification
npm run verify:counts      # Verify record counts
npm run verify:compliance  # Check Australian compliance
```

## Project Architecture

### High-Level Structure
TAAXDOG is a full-stack Australian tax and financial management application:
- **Frontend**: Next.js 14 with TypeScript, React 19
- **Backend**: Hybrid architecture with Next.js API routes and Python Flask services
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with email/password and Google OAuth
- **Payments**: Stripe integration with Australian GST compliance

### Directory Organization
```
/
├── pages/              # Next.js pages and API routes
│   ├── api/           # API endpoints (auth, ai, banking, etc.)
│   └── ...            # Frontend pages
├── components/        # React components organized by feature
├── lib/              # Core utilities and services
├── backend/          # Python Flask application
│   ├── api/          # Flask API endpoints
│   ├── services/     # Business logic services
│   └── middleware/   # Security and auth middleware
├── prisma/           # Database schema and migrations
├── scripts/          # Utility and maintenance scripts
└── styles/           # Global CSS and Tailwind config
```

### Key API Routes
- `/api/auth/*` - Authentication endpoints (NextAuth.js)
- `/api/ai/*` - AI services (insights, predictions, receipt processing)
- `/api/banking/*` - BASIQ banking integration
- `/api/stripe/*` - Payment processing and subscriptions
- `/api/admin/*` - Admin dashboard endpoints

### Database Schema
Prisma-managed PostgreSQL with models for:
- User authentication and profiles (Australian-specific fields)
- Subscriptions and billing (SMART/PRO plans)
- Tax returns and deductions
- Banking connections and transactions
- AI conversations and insights
- Receipts and expense tracking

### Security Architecture
- Multi-layered authentication with JWT tokens
- Role-based access control (USER, ADMIN, ACCOUNTANT, SUPPORT)
- Rate limiting (100 requests/minute)
- CSRF protection on all state-changing operations
- Request validation and sanitization
- Audit logging for compliance

### Australian Compliance Features
- ATO-compliant tax calculations
- GST handling (10% included in prices)
- ABN validation
- Tax invoice generation
- Australian tax year support (July 1 - June 30)
- Data residency in Sydney region