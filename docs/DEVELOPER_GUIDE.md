# TAAXDOG Developer Guide

**Last Updated**: January 17, 2025  
**Project Version**: 0.1.0  
**Status**: Production Ready

## Overview

TAAXDOG is an enterprise-grade financial management and Australian tax compliance platform built with Next.js, PostgreSQL, and AI integration. This guide provides comprehensive information for developers to understand, set up, and contribute to the project.

## Quick Start

### Prerequisites

```bash
# Required software
Node.js >= 18.0.0
npm >= 8.0.0
PostgreSQL >= 14.0
Docker (optional, recommended)
Git
```

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TaaxDog/TAAXDOG-CODING.git
   cd TAAXDOG-CODING
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment configuration:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Database setup:**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

### Docker Setup (Recommended)

```bash
# Development with Docker
docker-compose -f docker-compose.dev.yml up

# Production-like environment
docker-compose up
```

## Architecture Overview

### Technology Stack

**Frontend:**
- Next.js 15.3.4 with React 19
- TypeScript for type safety
- Tailwind CSS v4 for styling
- React Query for data fetching
- NextAuth.js for authentication

**Backend:**
- Next.js API Routes (primary)
- Python Flask (legacy, being migrated)
- Prisma ORM for database access
- PostgreSQL database

**External Services:**
- Basiq API (banking integration)
- Anthropic Claude (AI insights)
- Google Gemini (OCR processing)
- Stripe (payments)
- SendGrid (email)
- Sentry (monitoring)

### Project Structure

```
TAAXDOG-CODING/
├── pages/                    # Next.js pages and API routes
│   ├── api/                 # Backend API endpoints
│   │   ├── auth/           # Authentication endpoints
│   │   ├── banking/        # Banking/Basiq integration
│   │   ├── ai/             # AI service endpoints
│   │   ├── stripe/         # Payment processing
│   │   └── admin/          # Admin functions
│   ├── auth/               # Authentication pages
│   ├── dashboard/          # Main application pages
│   └── _app.tsx            # App configuration
├── components/              # React components
│   ├── auth/              # Authentication components
│   ├── dashboard/         # Dashboard components
│   ├── Goal/              # Financial goals management
│   ├── insights/          # AI insights display
│   ├── transactions/      # Transaction management
│   └── ui/                # Reusable UI components
├── lib/                    # Core utilities and services
│   ├── auth/              # Authentication utilities
│   ├── ai/                # AI service integrations
│   ├── basiq/             # Banking API client
│   ├── stripe/            # Payment processing
│   ├── db/                # Database utilities
│   ├── monitoring/        # Performance monitoring
│   └── types/             # TypeScript type definitions
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── backend/                # Python Flask services (legacy)
├── scripts/                # Utility and deployment scripts
├── tests/                  # Test suites
├── docs/                   # Documentation
└── docker/                 # Docker configuration files
```

## Development Workflow

### Code Quality Standards

**TypeScript:**
- Strict mode enabled
- No `any` types allowed
- Comprehensive type definitions
- ESLint + Prettier configuration

**Testing:**
- 80%+ test coverage requirement
- Jest with React Testing Library
- Unit, integration, and E2E tests
- Automated test runs on CI

**Code Style:**
- Consistent naming conventions
- Comprehensive comments and documentation
- Modular component design
- Clear separation of concerns

### Essential Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format with Prettier
npm run type-check       # TypeScript type checking
npm run quality:check    # Run all quality checks
npm run fix:all          # Fix naming, console, lint, format

# Testing
npm test                 # Run tests
npm run test:coverage    # Run tests with coverage
npm run test:watch       # Run tests in watch mode
npm run test:integration # Run integration tests

# Database
npm run migrate          # Run database migrations
npm run test-db          # Test database connection

# Analysis & Optimization
npm run analyze-bundle   # Analyze bundle size
npm run optimization:report # Generate optimization report

# Deployment
npm run deploy:validate  # Pre-deployment checks
npm run verify:quick     # Quick system verification
npm run verify:full      # Comprehensive verification
```

## Database Management

### Schema Design

The database uses PostgreSQL with Prisma ORM. Key models include:

- **Users**: User accounts and authentication
- **Goals**: Financial goals and tracking
- **Transactions**: Banking transactions
- **Receipts**: Receipt data and OCR results
- **Subscriptions**: Stripe subscription management
- **AuditLogs**: Compliance and security logging

### Migration Workflow

```bash
# Create new migration
npx prisma migrate dev --name descriptive_name

# Apply migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# View database
npx prisma studio
```

### Performance Optimization

Recent improvements include:
- 6 critical database indexes
- Query optimization patterns
- Connection pooling
- Row-level security (RLS)

## API Development

### REST API Guidelines

**Endpoint Structure:**
```
/api/[feature]/[action]
```

**Standard Response Format:**
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

**Authentication:**
- NextAuth.js session-based
- Role-based access control (RBAC)
- Rate limiting on all endpoints

**Error Handling:**
- Comprehensive error types
- Structured error responses
- Audit logging for failures

### Key API Routes

```
Authentication:
  POST /api/auth/register
  POST /api/auth/signin
  POST /api/auth/signout

Banking:
  GET  /api/banking/accounts
  POST /api/banking/sync
  GET  /api/banking/transactions

AI Services:
  POST /api/ai/insights
  POST /api/ai/categorize
  POST /api/ai/ocr

Goals:
  GET  /api/goals
  POST /api/goals
  PUT  /api/goals/[id]
  DELETE /api/goals/[id]

Payments:
  POST /api/stripe/create-checkout
  POST /api/stripe/webhook
```

## Frontend Development

### Component Architecture

**Component Guidelines:**
- Maximum 200 lines per component
- Single responsibility principle
- Comprehensive TypeScript types
- Proper error boundaries

**State Management:**
- React Context for global state
- React Query for server state
- Local state for component-specific data

**Styling:**
- Tailwind CSS v4
- Responsive design first
- Dark/light mode support
- Consistent design system

### Performance Optimization

**Implemented:**
- React Query for caching
- Lazy loading for heavy components
- Code splitting with dynamic imports
- Bundle size optimization

**Monitoring:**
- Sentry for error tracking
- Web Vitals monitoring
- Performance metrics

## Testing Strategy

### Test Types

**Unit Tests:**
- Individual component testing
- Utility function testing
- API endpoint testing

**Integration Tests:**
- Database integration
- External API integration
- Authentication flows

**End-to-End Tests:**
- Complete user workflows
- Critical business processes
- Cross-browser compatibility

### Test Configuration

```bash
# Jest configuration
jest.config.js              # Main Jest config
__tests__/setup.ts          # Test environment setup

# Test file patterns
*.test.ts(x)                # Unit tests
*.integration.test.ts       # Integration tests
__tests__/e2e/             # E2E tests
```

## Security & Compliance

### Security Measures

**Authentication & Authorization:**
- NextAuth.js with JWT sessions
- Role-based access control
- Multi-factor authentication support

**Data Protection:**
- AES-256-GCM field encryption
- Row-level security (RLS)
- Input validation and sanitization
- CSRF protection

**API Security:**
- Rate limiting
- Request validation
- Comprehensive audit logging
- Security headers

### Australian Compliance

**Financial Regulations:**
- AML/CTF compliance monitoring
- APRA guidelines adherence
- Privacy Act 1988 compliance
- GST calculation and reporting

**Data Residency:**
- Australian data centers
- Local data storage requirements
- Compliance reporting tools

## AI Integration

### Service Architecture

**Primary AI Providers:**
- Anthropic Claude 4 Sonnet (financial insights)
- Google Gemini Pro (OCR processing)
- Multi-provider fallback system

**Key Features:**
- Receipt OCR and data extraction
- Transaction categorization
- Financial insights and recommendations
- Tax compliance checking

### Implementation Guidelines

```typescript
// AI service pattern
interface AIServiceProvider {
  name: string;
  processReceipt(image: Buffer): Promise<ReceiptData>;
  generateInsights(transactions: Transaction[]): Promise<Insight[]>;
  categorizeTransaction(transaction: Transaction): Promise<Category>;
}
```

## Deployment & DevOps

### Container Architecture

**Docker Optimization:**
- Multi-stage builds
- Image size: 200MB (down from 1.5GB)
- Development and production configs
- Health checks and monitoring

**Configuration:**
```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up
```

### Environment Management

**Environment Files:**
```bash
.env.local           # Local development
.env.production      # Production configuration
.env.example         # Template with required variables
```

**Required Variables:**
- Database URLs
- API keys (AI services, banking, payments)
- Authentication secrets
- Monitoring and logging configs

### CI/CD Pipeline

**Automated Checks:**
- TypeScript compilation
- ESLint and Prettier
- Test suite execution
- Security vulnerability scanning
- Performance testing

## Troubleshooting

### Common Issues

**Development Setup:**
```bash
# Node modules issues
rm -rf node_modules package-lock.json
npm install

# Prisma issues
npx prisma generate
npx prisma migrate reset
```

**Database Connection:**
```bash
# Test database connection
npm run test-db

# Reset database
npx prisma migrate reset
```

**Build Issues:**
```bash
# Type checking
npm run type-check

# Clean build
rm -rf .next
npm run build
```

### Performance Debugging

```bash
# Bundle analysis
npm run analyze-bundle

# Performance monitoring
npm run optimization:report

# Database performance
npm run test:db-performance
```

## Best Practices

### Code Organization

1. **Feature-based structure**: Group related files together
2. **Clear naming conventions**: Descriptive and consistent names
3. **Comprehensive documentation**: Comments and README files
4. **Type safety**: Full TypeScript coverage
5. **Error handling**: Comprehensive error boundaries

### Development Workflow

1. **Branch strategy**: Feature branches with PR reviews
2. **Code quality**: Run quality checks before commits
3. **Testing**: Write tests for new features
4. **Documentation**: Update docs with changes
5. **Performance**: Monitor and optimize regularly

### Security Guidelines

1. **Input validation**: Validate all user inputs
2. **Authentication**: Secure session management
3. **Authorization**: Role-based access control
4. **Data encryption**: Encrypt sensitive data
5. **Audit logging**: Log security events

## Resources & Support

### Documentation

- [Architecture Guide](./architecture.md)
- [API Documentation](../pages/api/)
- [Security Guide](./SECURITY.md)
- [Compliance Guide](./COMPLIANCE.md)

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Australian Tax Office](https://www.ato.gov.au)

### Getting Help

1. **Documentation**: Check existing docs first
2. **GitHub Issues**: Report bugs and feature requests
3. **Code Reviews**: Get help through PR reviews
4. **Team Communication**: Use established communication channels

## Contributing

### Pull Request Process

1. **Fork and branch**: Create feature branch from main
2. **Development**: Implement changes with tests
3. **Quality checks**: Run all quality and test scripts
4. **Documentation**: Update relevant documentation
5. **Pull request**: Submit with clear description
6. **Review process**: Address feedback and iterate
7. **Merge**: Squash merge after approval

### Code Review Guidelines

**Reviewers should check:**
- Code quality and style consistency
- Test coverage and quality
- Security considerations
- Performance impact
- Documentation updates
- Compliance requirements

**Authors should ensure:**
- All tests pass
- Code quality checks pass
- Documentation is updated
- Changes are well-explained
- Breaking changes are noted

---

This developer guide provides the foundation for contributing to TAAXDOG. For specific technical details, refer to the documentation in the `/docs` directory and the inline code comments throughout the project.