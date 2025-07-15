# DigitalOcean Deployment Guide for TaxReturnPro

## Quick Fix for Current Issue

The client-side error on taxreturnpro.com.au is likely due to environment variable issues. Here's how to fix it:

### Option 1: Via DigitalOcean Web Console (Easiest)

1. **Log in to DigitalOcean**
   - Go to https://cloud.digitalocean.com
   - Navigate to Apps → taaxdog

2. **Update Environment Variables**
   - Click Settings tab
   - Find "App-Level Environment Variables"
   - Click "Edit"
   - Verify these critical variables exist:
     - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_51Re1oyLl1e8i03PEfTJeJ6DBeX1T7gzcXRCPWDzePSJGTwBJZYwECtZbGBcYA3H8tl5gxZUobLY4bYmseontkiBj00s6SiBehE`
     - `NEXTAUTH_URL` = `https://taxreturnpro.com.au`
     - `NEXTAUTH_SECRET` = (keep existing value)

3. **Add Missing Email Variables** (Required for password reset)
   - `SMTP_USER` = your-email@gmail.com (replace with your email)
   - `SMTP_PASS` = your-gmail-app-password (see below for how to generate)

4. **Save and Deploy**
   - Click "Save"
   - Click "Deploy" to trigger redeployment

### Option 2: Via Git Push (Automated)

The `digitalocean-app-spec.yaml` has been updated with all required variables. Simply:

```bash
git add digitalocean-app-spec.yaml
git commit -m "Fix: Update environment variables for production deployment"
git push origin main
```

This will automatically trigger a new deployment with the correct configuration.

## Setting Up Gmail App Password

1. **Enable 2-Factor Authentication**
   - Go to https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Copy the generated 16-character password

3. **Update DigitalOcean**
   - Replace `YOUR_EMAIL@gmail.com` with your Gmail address
   - Replace `YOUR_GMAIL_APP_PASSWORD` with the app password

## Verifying the Deployment

After deployment completes (5-10 minutes):

1. **Check Application**
   ```bash
   # Visit your site
   open https://taxreturnpro.com.au
   
   # Check browser console for errors (F12)
   ```

2. **Test Authentication**
   - Try to register a new account
   - Try to login
   - Test password reset

3. **Monitor Logs**
   - In DigitalOcean console, check "Runtime Logs"
   - Look for any startup errors

## Environment Variables Reference

### Critical Client-Side Variables (MUST have NEXT_PUBLIC_ prefix)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Required for Stripe integration

### Server-Side Variables
- `NEXTAUTH_URL` - Your app URL
- `NEXTAUTH_SECRET` - Session encryption key
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Set to "production"

### API Keys (All server-side)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook verification
- `ANTHROPIC_API_KEY` - Claude AI integration
- `OPENROUTER_API_KEY` - OpenRouter API
- `GEMINI_API_KEY` - Google Gemini API
- `BASIQ_API_KEY` - Banking integration

### Email Configuration
- `EMAIL_FROM` - noreply@taxreturnpro.com.au
- `SMTP_HOST` - smtp.gmail.com
- `SMTP_PORT` - 587
- `SMTP_USER` - Your Gmail address
- `SMTP_PASS` - Gmail app password
- `SMTP_SECURE` - false

### Security Keys (Generated)
- `SECRET_KEY` - Flask backend secret
- `JWT_SECRET_KEY` - JWT token signing
- `HEALTH_CHECK_TOKEN` - Health check authentication

## Troubleshooting

### If the site still shows errors:

1. **Clear Browser Cache**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

2. **Check Build Logs**
   - In DigitalOcean, go to Activity tab
   - Look for build errors

3. **Verify Environment Variables**
   - Ensure no typos in variable names
   - Check that NEXT_PUBLIC_ prefix is present for client variables

4. **Database Connection**
   - Verify DATABASE_URL is correct
   - Check if database is accessible

### Common Issues:

1. **"Application error" on page load**
   - Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   - Missing NEXTAUTH_URL or NEXTAUTH_SECRET

2. **Login/Signup not working**
   - Database connection issues
   - Missing authentication configuration

3. **Email not sending**
   - SMTP credentials not configured
   - Gmail app password incorrect

## Next Steps

1. **Update Email Credentials**
   - Replace placeholder email values with real credentials

2. **Configure Stripe Webhooks**
   - Set up webhook endpoint in Stripe dashboard
   - Point to: https://taxreturnpro.com.au/api/stripe/webhook

3. **Set Up Monitoring**
   - Configure alerts in DigitalOcean
   - Set up uptime monitoring

4. **Regular Maintenance**
   - Keep dependencies updated
   - Monitor error logs
   - Regular security reviews