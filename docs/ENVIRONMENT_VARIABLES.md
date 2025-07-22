# Environment Variables Documentation

This document lists all environment variables required for the TAAXDOG application.

## Required Environment Variables

### Application URLs
- `NEXTAUTH_URL` - The full URL where your app is hosted (e.g., `https://dev.taxreturnpro.com.au`)
- `APP_URL` - Alternative app URL, used as fallback for email links (optional if NEXTAUTH_URL is set)

### Database
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://user:pass@host:port/db?sslmode=require`)

### Authentication
- `NEXTAUTH_SECRET` - Random string for JWT encryption (generate with `openssl rand -base64 32`)

### Email Configuration
- `EMAIL_PROVIDER` - Email provider to use (`sendgrid` recommended)
- `SENDGRID_API_KEY` - SendGrid API key (must start with "SG.")
- `EMAIL_FROM` - Sender email address (must be from a verified domain in SendGrid)
  - Example: `noreply@taxreturnpro.com.au` or `noreply@dev.taxreturnpro.com.au`

### AI Services
- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `OPENROUTER_API_KEY` - OpenRouter API key (optional, for fallback)
- `GEMINI_API_KEY` - Google Gemini API key (for OCR/receipt scanning)

### Banking
- `BASIQ_API_KEY` - Basiq API key for banking integration

### Payments
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook endpoint secret

### Security
- `FIELD_ENCRYPTION_KEY` - 32-byte hex key for field-level encryption

### Optional
- `TEST_EMAIL_SECRET` - Secret key to access email test endpoint in production
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

## Important Notes

1. **Email Domain Verification**: The domain in `EMAIL_FROM` must be verified in SendGrid. Check SendGrid → Settings → Sender Authentication.

2. **URL Consistency**: `NEXTAUTH_URL` should match your actual deployment URL (e.g., `https://dev.taxreturnpro.com.au` for dev environment).

3. **SendGrid API Key**: Must start with "SG." - if it doesn't, it's not a valid SendGrid API key.

## DigitalOcean App Platform Setup

To add/update environment variables in DigitalOcean:

1. Go to your app in DigitalOcean App Platform
2. Click on "Settings" tab
3. Scroll to "Environment Variables"
4. Add or update variables
5. Click "Save"
6. The app will automatically redeploy

## Verifying Configuration

After deployment, check these endpoints:

1. **Email Test** (development only):
   ```bash
   curl -X POST https://dev.taxreturnpro.com.au/api/test/email \
     -H "Content-Type: application/json" \
     -d '{"to": "your-email@example.com"}'
   ```

2. **Check Logs**: Monitor DigitalOcean runtime logs for any configuration errors.