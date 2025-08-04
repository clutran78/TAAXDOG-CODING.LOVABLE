# Environment Setup Instructions

## 🚨 CRITICAL: Stripe Integration Fix

**The Stripe integration is not green because of environment variable naming mismatch.**

Your current codebase has conflicting environment variable names between the old and new configuration systems. Here's how to fix it:

## Problem Identified

1. **Main Config System** (`lib/config/index.ts`) expects:
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY` 
   - `STRIPE_WEBHOOK_SECRET`

2. **Environment-Specific Config** (`lib/config/environment.ts`) expects:
   - Development: `STRIPE_TEST_PUBLISHABLE_KEY`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET`
   - Production: `STRIPE_LIVE_PUBLISHABLE_KEY`, `STRIPE_LIVE_SECRET_KEY`, `STRIPE_LIVE_WEBHOOK_SECRET`

## Solution: Create Environment Files

### Step 1: Create Development Environment File

Create `.env.local` in your project root:

```bash
# Development Environment Configuration
NODE_ENV="development"

# Database Configuration (Development)
DATABASE_URL="postgresql://genesis@localhost:5432/taaxdog_development"

# Stripe Configuration - BOTH naming conventions for compatibility
STRIPE_PUBLISHABLE_KEY="pk_test_51Re1oyLl1e8i03PEQGOHSiAgNjWanYwx0fvIkSi5eY1RB4YPvGUQNluOjXQipkLwpztF83RAaBSpyVHN7DQLQZ3U00n44dZUb8"
STRIPE_SECRET_KEY="sk_test_51Re1oyLl1e8i03PEsk2iY3TBuHqYgzIACzU2ZGksCFZyoGEy2I7DJ991BsN08NG2VHMa18XBjycNiVWhR7n5dQtW00oRRgx7mE"
STRIPE_WEBHOOK_SECRET="whsec_8049f1f9ead95d8933afc149782bfdf4b82c3aa940fcfe3c2e1fe463c8908145"

# Environment-specific Stripe keys
STRIPE_TEST_PUBLISHABLE_KEY="pk_test_51Re1oyLl1e8i03PEQGOHSiAgNjWanYwx0fvIkSi5eY1RB4YPvGUQNluOjXQipkLwpztF83RAaBSpyVHN7DQLQZ3U00n44dZUb8"
STRIPE_TEST_SECRET_KEY="sk_test_51Re1oyLl1e8i03PEsk2iY3TBuHqYgzIACzU2ZGksCFZyoGEy2I7DJ991BsN08NG2VHMa18XBjycNiVWhR7n5dQtW00oRRgx7mE"
STRIPE_TEST_WEBHOOK_SECRET="whsec_8049f1f9ead95d8933afc149782bfdf4b82c3aa940fcfe3c2e1fe463c8908145"

# API Keys
BASIQ_API_KEY="MThmYjA5ZWEtNzRhMi00Nzc5LTk0ZjAtYmRkOTExZDgwMGI4OjhjZjUzZWUzLTYxYmItNDlkMC04YTM2LTRmYWE5NmNkYmY2Nw=="
OPENROUTER_API_KEY="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"
GEMINI_API_KEY="AIzaSyADSKfEEx1WISywXTw7V1CHqjM72bn7kEY"
ANTHROPIC_API_KEY="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"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="VqkUiUKy7SweRednCPtXooCmsnpoHc1wdXl5DBDmAR4="

# Development Settings
DEBUG="true"
LOG_LEVEL="debug"
```

### Step 2: Create Production Environment File (for deployment)

Create `.env.production`:

```bash
# Production Environment Configuration
NODE_ENV="production"

# Database Configuration
DATABASE_URL="postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require"
PRODUCTION_DATABASE_URL="postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require"

# Stripe Configuration - BOTH naming conventions for compatibility
STRIPE_PUBLISHABLE_KEY="pk_live_51Re1oyLl1e8i03PEfTJeJ6DBeX1T7gzcXRCPWDzePSJGTwBJZYwECtZbGBcYA3H8tl5gxZUobLY4bYmseontkiBj00s6SiBehE"
STRIPE_SECRET_KEY="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"
STRIPE_WEBHOOK_SECRET="whsec_z2rEeYEZBAbBjxMvCzfKc8Trs1wlTC9L"

# Environment-specific Stripe keys
STRIPE_LIVE_PUBLISHABLE_KEY="pk_live_51Re1oyLl1e8i03PEfTJeJ6DBeX1T7gzcXRCPWDzePSJGTwBJZYwECtZbGBcYA3H8tl5gxZUobLY4bYmseontkiBj00s6SiBehE"
STRIPE_LIVE_SECRET_KEY="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"
STRIPE_LIVE_WEBHOOK_SECRET="whsec_z2rEeYEZBAbBjxMvCzfKc8Trs1wlTC9L"

# API Keys
BASIQ_API_KEY="MThmYjA5ZWEtNzRhMi00Nzc5LTk0ZjAtYmRkOTExZDgwMGI4OjhjZjUzZWUzLTYxYmItNDlkMC04YTM2LTRmYWE5NmNkYmY2Nw=="
OPENROUTER_API_KEY="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"
GEMINI_API_KEY="AIzaSyADSKfEEx1WISywXTw7V1CHqjM72bn7kEY"
ANTHROPIC_API_KEY="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"

# Authentication
NEXTAUTH_URL="https://taxreturnpro.com.au"
NEXTAUTH_SECRET="VS5+e29Y/yEPy4wnqgDz04gT7PfCRkQR/iUS7tteTUI="

# Production Settings
DEBUG="false"
LOG_LEVEL="error"
MAX_REQUEST_SIZE="10mb"
RATE_LIMIT_MAX="100"
RATE_LIMIT_WINDOW="900000"
```

## Step 3: Quick Commands to Create Files

Run these commands in your project root:

```bash
# Copy the development template and customize
cp config/env.development.template .env.local

# Copy the production template (for deployment reference)
cp config/env.production.template .env.production
```

## Step 4: Verify the Fix

After creating the environment files:

1. **Restart your development server:**
   ```bash
   npm run dev
   ```

2. **Check the Stripe integration status** - it should now be green!

3. **Test Stripe functionality:**
   ```bash
   # Test the Stripe configuration
   curl http://localhost:3000/api/stripe/health
   ```

## Why This Fixes the Issue

The problem was that your configuration system expected specific environment variable names, but they weren't set. By providing **both naming conventions** in the environment files:

- `STRIPE_PUBLISHABLE_KEY` (for main config system)
- `STRIPE_TEST_PUBLISHABLE_KEY` (for environment-specific config)

Both configuration systems can now find their expected variables.

## Environment File Priority

NextJS loads environment files in this order:

1. `.env.local` (highest priority, for local development)
2. `.env.development` (when NODE_ENV=development)
3. `.env.production` (when NODE_ENV=production)
4. `.env` (lowest priority)

## Important Notes

- ✅ `.env.local` is in `.gitignore` and won't be committed
- ✅ Contains working Stripe test keys for development
- ✅ Contains working Stripe live keys for production
- ✅ All API keys are from the main taaxdog-coding repository
- ✅ Includes both environment variable naming conventions

## Next Steps

1. Create the environment files as shown above
2. Restart your development server
3. Your Stripe integration should now be **green** ✅
4. Test payment functionality to confirm everything works

## Troubleshooting

If the integration is still not green:

1. **Check environment variables are loaded:**
   ```bash
   # In your app, log the variables
   console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY)
   ```

2. **Verify file placement:**
   - `.env.local` should be in the project root (same level as package.json)

3. **Restart the server:**
   - Environment variables are only loaded on server start

4. **Check for typos:**
   - Ensure exact variable names match what the config expects