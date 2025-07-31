# Environment Variables Sync Report
## .env.local vs DigitalOcean Deployment (app.yaml)

Generated on: 2025-07-31

## 🔴 CRITICAL ISSUES

### Missing in DigitalOcean Deployment:
1. **OPENAI_API_KEY** - Required for AI receipt processing
   - In .env.local: `your-openai-api-key` (needs actual key)
   - Status: **MISSING** in app.yaml

2. **BASIQ_ENCRYPTION_KEY** - Required for banking data encryption
   - In .env.local: `your-basiq-encryption-key-32-chars` (needs actual key)
   - Status: **MISSING** in app.yaml

3. **EMAIL_SERVER_*** - SMTP configuration for password reset
   - EMAIL_SERVER_HOST
   - EMAIL_SERVER_PORT
   - EMAIL_SERVER_USER
   - EMAIL_SERVER_PASSWORD
   - Status: **MISSING** in app.yaml

4. **ENCRYPTION_KEY** - Secondary encryption key
   - In .env.local: Present with value
   - Status: **MISSING** in app.yaml

## 🟡 CONFIGURATION MISMATCHES

### Different Key Names:
1. **Email Configuration**
   - .env.local: `EMAIL_FROM`
   - app.yaml: `FROM_EMAIL`
   - Both set to: `noreply@taxreturnpro.com.au`

2. **JWT Configuration**
   - .env.local: `JWT_SECRET`
   - app.yaml: `JWT_SECRET_KEY`

3. **BASIQ API URL**
   - .env.local: `BASIQ_API_URL`
   - app.yaml: `BASIQ_SERVER_URL`
   - Both set to: `https://au-api.basiq.io`

## 🟢 PROPERLY SYNCED

### Core Services:
- ✅ DATABASE_URL
- ✅ DATABASE_POOLING_URL
- ✅ NEXTAUTH_SECRET
- ✅ NEXTAUTH_URL (different values for dev/prod as expected)

### Payment Processing (Stripe):
- ✅ STRIPE_PUBLISHABLE_KEY
- ✅ STRIPE_SECRET_KEY
- ✅ STRIPE_WEBHOOK_SECRET
- ✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

### AI Services:
- ✅ ANTHROPIC_API_KEY
- ✅ OPENROUTER_API_KEY
- ✅ GEMINI_API_KEY

### Other Services:
- ✅ SENDGRID_API_KEY
- ✅ BASIQ_API_KEY
- ✅ FIELD_ENCRYPTION_KEY
- ✅ SENTRY_DSN

## 🔵 ENVIRONMENT-SPECIFIC VARIABLES

### Only in .env.local (Development):
- DATABASE_URL_DEVELOPMENT
- Various development flags (DEBUG, CUSTOM_KEY, etc.)
- Test credentials (STRIPE_TEST_SECRET_KEY, etc.)
- Local configuration (LOG_LEVEL, ALLOWED_ORIGINS)

### Only in app.yaml (Production):
- Stripe price IDs (STRIPE_EARLY_ACCESS_PRICE_ID_*, STRIPE_PRICE_ID_*)
- Firebase configuration (legacy system)
- AUSTRAC_API_KEY (compliance)
- ABN_LOOKUP_GUID (tax compliance)
- FLASK_API_KEY (backend service)
- Feature flags (FEATURE_*_ENABLED)

## 📋 ACTION ITEMS

### High Priority:
1. **Add OPENAI_API_KEY to DigitalOcean**
   - Required for AI receipt processing functionality
   - Add to DigitalOcean App Platform environment variables

2. **Configure Email Server Variables**
   - Add EMAIL_SERVER_* variables for SMTP
   - Or ensure SendGrid is properly configured for all email needs

3. **Add BASIQ_ENCRYPTION_KEY**
   - Generate a proper 32-character encryption key
   - Add to both .env.local and DigitalOcean

### Medium Priority:
1. **Align JWT key names**
   - Update code to use consistent naming (JWT_SECRET or JWT_SECRET_KEY)

2. **Align email configuration keys**
   - Update code to use consistent naming (EMAIL_FROM or FROM_EMAIL)

3. **Add ENCRYPTION_KEY to deployment**
   - If this secondary encryption key is used in the code

### Low Priority:
1. **Review Firebase configuration**
   - Determine if Firebase is still needed (appears to be legacy)

2. **Document environment-specific variables**
   - Create clear documentation for which variables are dev/prod specific

## 🔐 SECURITY NOTES

1. Several keys in .env.local appear to be placeholder values:
   - OPENAI_API_KEY: "your-openai-api-key"
   - BASIQ_ENCRYPTION_KEY: "your-basiq-encryption-key-32-chars"
   - EMAIL_SERVER_USER: "your-email@gmail.com"
   - EMAIL_SERVER_PASSWORD: "your-app-password"

2. Ensure all actual API keys are:
   - Stored securely in DigitalOcean's encrypted environment variables
   - Never committed to version control
   - Rotated regularly

## 🚀 DEPLOYMENT CHECKLIST

Before next deployment:
- [ ] Add OPENAI_API_KEY to DigitalOcean
- [ ] Configure email server variables or verify SendGrid handles all email
- [ ] Add BASIQ_ENCRYPTION_KEY with proper value
- [ ] Verify all placeholder values are replaced with actual credentials
- [ ] Test authentication flow with proper email configuration
- [ ] Verify AI features work with OpenAI integration