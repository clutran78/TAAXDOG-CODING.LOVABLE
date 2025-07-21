# Environment Configuration System

## Overview

The TAAXDOG application uses a robust environment configuration system that prevents key overlap between development and production environments. This system ensures:

- ✅ **No key conflicts** between environments
- ✅ **Automatic validation** of configurations  
- ✅ **Easy environment switching**
- ✅ **Type-safe configuration**

## Quick Setup

### Development Environment

```bash
# Set up development environment
npm run env:dev

# Start the development server
npm run dev
```

### Production Environment

```bash
# Set up production environment  
npm run env:prod

# Build and start production server
npm run build
npm start
```

## Environment Management Commands

| Command | Description |
|---------|-------------|
| `npm run env:dev` | Switch to development environment |
| `npm run env:prod` | Switch to production environment |
| `npm run env:staging` | Switch to staging environment |
| `npm run env:status` | Show current environment status |
| `npm run env:help` | Show help for environment commands |

## Environment Configuration

### Development Configuration

**File**: `config/env.development.template`

- **Database**: Local PostgreSQL (`localhost:5432`)
- **Stripe**: Test mode keys (`pk_test_...`, `sk_test_...`)
- **URLs**: `http://localhost:3000`
- **Debug**: Enabled
- **SSL**: Disabled

### Production Configuration

**File**: `config/env.production.template`

- **Database**: DigitalOcean PostgreSQL (with SSL)
- **Stripe**: Live mode keys (`pk_live_...`, `sk_live_...`)
- **URLs**: `https://taxreturnpro.com.au`
- **Debug**: Disabled  
- **SSL**: Required

## Key Separation Logic

### Development Keys
```bash
# Stripe (Test Mode Only)
STRIPE_TEST_PUBLISHABLE_KEY="pk_test_..."
STRIPE_TEST_SECRET_KEY="sk_test_..."
STRIPE_TEST_WEBHOOK_SECRET="whsec_..."

# Database (Local)
DATABASE_URL="postgresql://genesis@localhost:5432/taaxdog_development"

# Auth (Local)
NEXTAUTH_URL="http://localhost:3000"
```

### Production Keys
```bash
# Stripe (Live Mode Only)  
STRIPE_LIVE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_LIVE_SECRET_KEY="sk_live_..."
STRIPE_LIVE_WEBHOOK_SECRET="whsec_..."

# Database (Production)
PRODUCTION_DATABASE_URL="postgresql://..."

# Auth (Production)
NEXTAUTH_URL="https://taxreturnpro.com.au"
```

## Validation System

The system automatically validates configurations:

### Development Validation
- ✅ Must use `STRIPE_TEST_` keys
- ❌ Cannot use `STRIPE_LIVE_` keys  
- ✅ Must use `localhost:3000`
- ✅ `NODE_ENV` must be `development`

### Production Validation
- ✅ Must use `STRIPE_LIVE_` keys
- ❌ Cannot use `STRIPE_TEST_` keys
- ✅ Must use production domain
- ✅ `NODE_ENV` must be `production`

## Environment Switching

### Manual Method
1. Copy the appropriate template:
   ```bash
   cp config/env.development.template .env.local
   # OR
   cp config/env.production.template .env.local
   ```

### Automated Method (Recommended)
```bash
# Development
npm run env:dev

# Production  
npm run env:prod

# Check status
npm run env:status
```

## Configuration Architecture

```
lib/config/
├── environment.ts          # Dynamic environment loader
├── index.ts                # Main configuration with validation
config/
├── env.development.template # Development template
├── env.production.template  # Production template
└── env.staging.template     # Staging template (future)
scripts/
└── env-manager.js          # Environment management script
```

## TypeScript Integration

The system provides type-safe configuration:

```typescript
import config from '@/lib/config/environment';

// Type-safe access
const stripeMode = config.stripe.mode; // 'test' | 'live'
const databaseUrl = config.database.url;
const isProduction = config.env === 'production';

// Environment-specific logic
if (config.env === 'development') {
  console.log('Development mode - using test Stripe keys');
} else {
  console.log('Production mode - using live Stripe keys');
}
```

## Security Features

### Key Validation
- **Development**: Enforces test keys only
- **Production**: Enforces live keys only
- **No Overlap**: Prevents accidental key mixing

### Environment Detection
- Automatic environment detection from `NODE_ENV`
- Validation of environment-specific settings
- Error reporting for invalid configurations

### Backup System
- Automatic backup of existing `.env.local` before changes
- Timestamped backups for recovery
- Safe environment switching

## Troubleshooting

### Common Issues

**Issue**: `❌ Validation failed: Development should use STRIPE_TEST_ keys`
**Solution**: Run `npm run env:dev` to set correct development keys

**Issue**: `❌ Configuration validation failed: NODE_ENV should be "development"`
**Solution**: Ensure NODE_ENV matches your intended environment

**Issue**: `❌ No .env.local file found`
**Solution**: Run `npm run env:dev` or `npm run env:prod` to create configuration

### Reset Configuration
```bash
# Check current status
npm run env:status

# Reset to development
npm run env:dev

# Validate configuration
npm run env:validate
```

### Environment Variables Debug
```bash
# Show current environment summary
npm run env:status

# Validate current configuration
npm run env:validate
```

## Best Practices

1. **Always use environment commands** instead of manually editing `.env.local`
2. **Validate after switching** environments with `npm run env:status`
3. **Never commit** `.env.local` to version control
4. **Use staging environment** for testing production configurations
5. **Regular validation** before deployments

## Migration from Old System

If you have an existing `.env.local` with mixed keys:

1. **Backup current file**:
   ```bash
   cp .env.local .env.local.backup
   ```

2. **Set development environment**:
   ```bash
   npm run env:dev
   ```

3. **Validate configuration**:
   ```bash
   npm run env:status
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Support

For environment configuration issues:
1. Check `npm run env:status`
2. Validate with `npm run env:validate`  
3. Reset with `npm run env:dev`
4. Review this documentation

The system is designed to prevent configuration errors and make environment management simple and safe. 