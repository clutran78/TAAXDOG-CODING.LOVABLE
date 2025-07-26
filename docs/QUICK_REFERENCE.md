# TAAXDOG Quick Reference Guide

**Last Updated**: January 17, 2025  
**Version**: 0.1.0

## Essential Commands

### Development Setup
```bash
# Quick start
git clone https://github.com/TaaxDog/TAAXDOG-CODING.git
cd TAAXDOG-CODING
npm install
cp .env.example .env.local
npx prisma generate && npx prisma migrate dev
npm run dev
```

### Daily Development
```bash
npm run dev              # Start development server (http://localhost:3000)
npm run quality:check    # Run all code quality checks
npm test                 # Run test suite
npm run type-check       # TypeScript validation
npm run fix:all          # Auto-fix common issues
```

### Database Operations
```bash
npx prisma studio        # Open database GUI
npx prisma migrate dev   # Create and apply migration
npm run test-db          # Test database connection
npx prisma migrate reset # Reset database (development only)
```

### Code Quality & Testing
```bash
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run test:coverage    # Test with coverage report
npm run test:integration # Run integration tests
npm run test:watch       # Test in watch mode
```

### Performance & Analysis
```bash
npm run analyze-bundle     # Analyze bundle size
npm run optimization:report # Performance report
npm run monitoring:setup   # Setup performance monitoring
```

### Deployment & Validation
```bash
npm run build              # Production build
npm run deploy:validate    # Pre-deployment checks
npm run verify:full        # Comprehensive system verification
npm run security:validate  # Security validation
```

## Environment Variables (Essential)

### Required for Development
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/taaxdog"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# AI Services
ANTHROPIC_API_KEY="sk-ant-api03-..."
GEMINI_API_KEY="AIzaSy..."

# Banking (Optional for development)
BASIQ_API_KEY="your-basiq-key"

# Payments (Required for subscription features)
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
```

## Project Structure (Key Directories)

```
TAAXDOG-CODING/
├── pages/api/           # Backend API endpoints
├── components/          # React components
├── lib/                 # Core utilities and services
├── prisma/             # Database schema and migrations
├── docs/               # Documentation
├── tests/              # Test suites
└── scripts/            # Utility scripts
```

## API Endpoints (Most Used)

```
# Authentication
POST /api/auth/register
POST /api/auth/signin

# Goals Management
GET  /api/goals
POST /api/goals
PUT  /api/goals/[id]

# Banking & Transactions
GET  /api/banking/accounts
GET  /api/banking/transactions
POST /api/banking/sync

# AI Services
POST /api/ai/insights
POST /api/ai/categorize
```

## Common Issues & Solutions

### Build Errors
```bash
# Clear caches and rebuild
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### Database Connection Issues
```bash
# Reset and reconnect
npx prisma migrate reset
npx prisma generate
npm run test-db
```

### TypeScript Errors
```bash
# Type checking and fixes
npm run type-check
npm run lint:fix
```

### Test Failures
```bash
# Clear Jest cache and rerun
npm test -- --clearCache
npm test
```

## Docker Quick Start

```bash
# Development with Docker
docker-compose -f docker-compose.dev.yml up

# Production environment
docker-compose up

# Rebuild containers
docker-compose build --no-cache
```

## Git Workflow

```bash
# Feature development
git checkout -b feature/your-feature-name
# Make changes
npm run quality:check
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
# Create PR on GitHub
```

## Testing Quick Commands

```bash
# Run specific tests
npm test -- --testNamePattern="Goal"
npm test -- components/Goal/

# Coverage for specific files
npm test -- --coverage --testPathPattern="Goal"

# Integration tests only
npm run test:integration
```

## Performance Monitoring

```bash
# Bundle analysis
npm run analyze-bundle

# Performance report
npm run optimization:report

# Monitor in development
npm run dev
# Open: http://localhost:3000 and check DevTools
```

## Security & Compliance

```bash
# Security validation
npm run security:validate

# Compliance checks
npm run compliance:all

# Audit logs maintenance
npm run audit:maintenance
```

## Deployment Checklist

- [ ] `npm run quality:check` passes
- [ ] `npm test -- --coverage` shows 80%+ coverage
- [ ] `npm run deploy:validate` passes
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Security validation complete

## Common File Locations

```
Configuration:
  .env.local              # Local environment variables
  .env.example            # Environment template
  package.json            # Dependencies and scripts
  
Database:
  prisma/schema.prisma    # Database schema
  prisma/migrations/      # Database migrations
  
Documentation:
  README.md               # Main project documentation
  docs/DEVELOPER_GUIDE.md # Comprehensive developer guide
  docs/architecture.md    # Technical architecture
  
Testing:
  jest.config.js          # Jest configuration
  __tests__/              # Test files
```

## Key Features Status

✅ **Production Ready Features:**
- Authentication & Authorization
- Banking Integration (Basiq)
- AI-Powered Insights (Claude/Gemini)
- Financial Goals Management
- Transaction Categorization
- Australian Tax Compliance
- Subscription Management (Stripe)
- Real-time Performance Monitoring

🚧 **In Progress:**
- Flask to Next.js API migration
- Enhanced mobile experience
- Real-time WebSocket features

## Support & Resources

### Documentation
- [Complete Developer Guide](./DEVELOPER_GUIDE.md)
- [Architecture Overview](./architecture.md)
- [Security Guidelines](./SECURITY.md)
- [API Documentation](../pages/api/)

### External Links
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

### Getting Help
1. Check documentation in `/docs`
2. Run diagnostic commands
3. Check existing GitHub issues
4. Create new issue with details

---

**Quick Tip**: Run `npm run quality:check` before every commit to catch issues early!