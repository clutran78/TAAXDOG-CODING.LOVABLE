# Complete TaxReturnPro Setup Guide

Since your app includes AI functionality for financial advice and tax claims, you'll need both email and backend configuration.

## Required Environment Variables

### 1. Email Configuration (For Password Reset)
```env
EMAIL_FROM=noreply@taxreturnpro.com.au
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

**Quick Gmail Setup:**
1. Go to https://myaccount.google.com/apppasswords
2. Generate an app password for "Mail"
3. Use the 16-character password (without spaces)

### 2. Flask Backend Configuration (For AI Features)
```env
SECRET_KEY=[generate-with-command-below]
JWT_SECRET_KEY=[generate-with-command-below]
CORS_ORIGINS=https://taxreturnpro.com.au
```

**Generate Secure Keys:**
```bash
# Run this command twice to get two different keys
openssl rand -base64 32
```

### 3. Email Service Variables (For Production)
The email system looks for these SMTP variables:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
SMTP_SECURE=false
```

## Complete .env File Template

```env
# Development Environment Variables
# This file should NEVER be committed to version control

# Application
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=NGajSj1kFOuhgHw6pE6ErVDWrY1rGfVNllf6XJEk07k=

# Database (Already configured)
DATABASE_URL=postgresql://taaxdog-admin:AVNS_sOOnNB63elYEvJLTVuy@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require

# Stripe (Already configured)
STRIPE_PUBLISHABLE_KEY=pk_test_51Re1p5Q9NPu52BBJ73SbAmHhscSxbC2zUkbnm5ZhSv3JVyqj7SMpH3FzAbhxahZXlXbLz8g29VUzbELwaurCmMyM00eD2TZj24
STRIPE_SECRET_KEY=sk_test_51Re1p5Q9NPu52BBJyvEXIWch7vEEKkVaiiwqbHgTtmTOHpULNAU7zgFh75d6pGtrA7JVvW5LkBmXzASSAcrUfwN000LpnkaHUm
STRIPE_WEBHOOK_SECRET=whsec_ReF2BwG3c0NUFaxAmPjSPnbZdzhADnGp

# AI Services (Already configured)
ANTHROPIC_API_KEY=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
OPENROUTER_API_KEY=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
GEMINI_API_KEY=AIzaSyDLm3ZrbamQTN05Yc_OLuYOc47YIgKvSa0

# Banking Integration (Already configured)
BASIQ_API_KEY=MThmYjA5ZWEtNzRhMi00Nzc5LTk0ZjAtYmRkOTExZDgwMGI4Ojg5MDcxY2FjLTY3MmUtNDBkNy04OTY4LWRjZjdhYTY0YjYyYw==

# Email Configuration (NEEDED)
EMAIL_FROM=noreply@taxreturnpro.com.au
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password

# SMTP Configuration (NEEDED - Same values as email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false

# Flask Backend Configuration (NEEDED)
SECRET_KEY=generate-secure-key-for-production
JWT_SECRET_KEY=generate-secure-jwt-key-for-production
CORS_ORIGINS=http://localhost:3000,https://taxreturnpro.com.au
```

## DigitalOcean Production Variables

Add these to your DigitalOcean App Platform:

### Email Variables (Required)
- `EMAIL_FROM`: noreply@taxreturnpro.com.au
- `EMAIL_HOST`: smtp.gmail.com
- `EMAIL_PORT`: 587
- `EMAIL_USER`: [Your Gmail]
- `EMAIL_PASSWORD`: [Encrypted - Your App Password]
- `SMTP_HOST`: smtp.gmail.com
- `SMTP_PORT`: 587
- `SMTP_USER`: [Your Gmail]
- `SMTP_PASS`: [Encrypted - Your App Password]
- `SMTP_SECURE`: false

### Backend Security (Required)
- `SECRET_KEY`: [Encrypted - Generate with openssl]
- `JWT_SECRET_KEY`: [Encrypted - Generate with openssl]
- `CORS_ORIGINS`: https://taxreturnpro.com.au

## Why Each is Needed

1. **Email/SMTP Variables**: Enable password reset functionality
2. **SECRET_KEY**: Secures Flask sessions and forms
3. **JWT_SECRET_KEY**: Secures API authentication for AI features
4. **CORS_ORIGINS**: Allows frontend to communicate with Flask backend

## Testing Checklist

After setup, test these features:
- [ ] User registration
- [ ] Password reset email delivery
- [ ] AI chat functionality
- [ ] Tax deduction recommendations
- [ ] Banking integration
- [ ] Receipt scanning with AI

All core features including AI functionality will work once these are configured!