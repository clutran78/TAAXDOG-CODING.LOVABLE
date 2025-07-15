# TaxReturnPro Production Setup Guide

## Issue: Client-side error on www.taxreturnpro.com.au

The application is experiencing a client-side error that prevents login/signup. This is likely due to missing environment variables in the DigitalOcean deployment.

## Solution: Configure Environment Variables on DigitalOcean

### Required Environment Variables

Add these environment variables to your DigitalOcean App Platform settings:

```bash
# Application Configuration
NODE_ENV=production
NEXTAUTH_URL=https://taxreturnpro.com.au
NEXTAUTH_SECRET=VS5+e29Y/yEPy4wnqgDz04gT7PfCRkQR/iUS7tteTUI=

# Database Configuration
DATABASE_URL=postgresql://taaxdog-admin:AVNS_sOOnNB63elYEvJLTVuy@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require

# Stripe Configuration (IMPORTANT: Must include NEXT_PUBLIC_ prefix for client-side)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51Re1oyLl1e8i03PEfTJeJ6DBeX1T7gzcXRCPWDzePSJGTwBJZYwECtZbGBcYA3H8tl5gxZUobLY4bYmseontkiBj00s6SiBehE
STRIPE_SECRET_KEY=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
STRIPE_WEBHOOK_SECRET=whsec_z2rEeYEZBAbBjxMvCzfKc8Trs1wlTC9L

# AI Services
ANTHROPIC_API_KEY=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
OPENROUTER_API_KEY=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
GEMINI_API_KEY=AIzaSyADSKfEEx1WISywXTw7V1CHqjM72bn7kEY

# Banking Integration
BASIQ_API_KEY=MThmYjA5ZWEtNzRhMi00Nzc5LTk0ZjAtYmRkOTExZDgwMGI4OjhjZjUzZWUzLTYxYmItNDlkMC04YTM2LTRmYWE5NmNkYmY2Nw==

# Email Configuration (Update with your actual email credentials)
EMAIL_FROM=noreply@taxreturnpro.com.au
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_SECURE=false
```

### Steps to Fix:

1. **Login to DigitalOcean App Platform**
   - Go to your app at: https://cloud.digitalocean.com/apps

2. **Navigate to Settings > App-Level Environment Variables**
   - Click on "Edit" next to Environment Variables

3. **Add ALL the environment variables listed above**
   - Make sure to include the `NEXT_PUBLIC_` prefix for the Stripe publishable key
   - This is critical for client-side functionality

4. **Deploy the Application**
   - After adding environment variables, click "Deploy" to redeploy with the new configuration

5. **Verify the Fix**
   - Wait for deployment to complete (usually 5-10 minutes)
   - Visit https://taxreturnpro.com.au
   - Test login and signup functionality

### Additional Debugging:

If issues persist after adding environment variables:

1. **Check Build Logs**
   - In DigitalOcean App Platform, go to "Activity" tab
   - Look for any build errors

2. **Check Runtime Logs**
   - In "Runtime Logs" tab, look for any errors during page load

3. **Browser Console**
   - Open browser developer tools (F12)
   - Check Console tab for specific client-side errors

### Local Testing:

To test the production build locally:

```bash
# Build with production environment
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51Re1oyLl1e8i03PEfTJeJ6DBeX1T7gzcXRCPWDzePSJGTwBJZYwECtZbGBcYA3H8tl5gxZUobLY4bYmseontkiBj00s6SiBehE npm run build

# Start production server
npm start
```

### Important Notes:

1. **Client-side Environment Variables**: Any environment variable that needs to be available in the browser must be prefixed with `NEXT_PUBLIC_`

2. **Security**: Never expose secret keys (like `STRIPE_SECRET_KEY`) to the client. Only `NEXT_PUBLIC_` prefixed variables are safe for client-side use.

3. **Email Configuration**: Update the SMTP credentials with your actual email service credentials for password reset functionality to work.

4. **Health Check**: The app includes health check endpoints at `/api/health` and `/api/health/readiness` for monitoring.