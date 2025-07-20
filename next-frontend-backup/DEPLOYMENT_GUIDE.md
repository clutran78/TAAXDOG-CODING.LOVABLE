# TAAX Deployment Guide - Environment Variables Setup

## Your Generated Secrets
### NEXTAUTH_SECRET
```
bBmu13YaV1afxlHSM6EslA98rmB9FcqlaNyTijMQFL0=
```

### API_KEY_ENCRYPTION_SECRET
```
a41735af5f90a061f5272a67d232021722d145901ec6160f0cd0e98e9a0d12b7
```

## Environment Variables to Set in DigitalOcean

Copy and paste these into your DigitalOcean App Platform settings:

### 1. Core Authentication Variables
```
DATABASE_URL = postgresql://taaxdog-admin:[YOUR_DATABASE_PASSWORD]@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25061/taaxdog-production?sslmode=require

NEXTAUTH_SECRET = bBmu13YaV1afxlHSM6EslA98rmB9FcqlaNyTijMQFL0=

NEXTAUTH_URL = https://taxreturnpro.com.au

NODE_ENV = production

APP_URL = https://taxreturnpro.com.au
```

### 2. Email Configuration (SendGrid)
```
EMAIL_PROVIDER = sendgrid

SENDGRID_API_KEY = [Your SendGrid API key - starts with SG.]

EMAIL_FROM = noreply@taxreturnpro.com.au
```

### 3. API Keys (from your existing setup)
```
ANTHROPIC_API_KEY = [Your Anthropic API key]

OPENROUTER_API_KEY = [Your OpenRouter API key]

GEMINI_API_KEY = [Your Gemini API key]

BASIQ_API_KEY = [Your BASIQ API key]

API_KEY_ENCRYPTION_SECRET = a41735af5f90a061f5272a67d232021722d145901ec6160f0cd0e98e9a0d12b7
```

### 4. Stripe Configuration
```
STRIPE_PUBLISHABLE_KEY = [Your Stripe publishable key - starts with pk_]

STRIPE_SECRET_KEY = [Your Stripe secret key - starts with sk_]

STRIPE_WEBHOOK_SECRET = [Your Stripe webhook secret - starts with whsec_]
```

## Step-by-Step Instructions

### 1. Access DigitalOcean App Platform
1. Log into https://cloud.digitalocean.com/
2. Click on "Apps" in the left sidebar
3. Find and click on your app (should be named something like "taaxdog" or "taxreturnpro")

### 2. Navigate to Environment Variables
1. Click on the "Settings" tab
2. Scroll down to "App-Level Environment Variables"
3. Click the "Edit" button

### 3. Add Environment Variables
1. Click "Add Variable" for each variable
2. For each variable:
   - Enter the KEY (e.g., `DATABASE_URL`)
   - Enter the VALUE (replace placeholders with actual values)
   - Make sure "Encrypt" is checked for sensitive values
3. Click "Save" after adding all variables

### 4. Deploy the Application
1. The app should automatically redeploy after saving environment variables
2. If not, click "Deploy" button at the top
3. Monitor the deployment in the "Activity" tab

### 5. Verify Deployment
1. Check deployment logs for:
   - "✓ Production database credentials detected"
   - "Initializing SendGrid with valid API key"
   - No error messages
2. Visit https://taxreturnpro.com.au to ensure the site loads

## Testing Authentication

### Test 1: Create Account
1. Go to https://taxreturnpro.com.au/auth/signup
2. Enter:
   - Name: Test User
   - Email: your-email@example.com
   - Password: TestPassword123!
3. Click "Create account"
4. You should be redirected to login page

### Test 2: Login
1. Go to https://taxreturnpro.com.au/auth/login
2. Enter the credentials from Test 1
3. Click "Sign in"
4. You should be logged in successfully

### Test 3: Password Reset
1. Go to https://taxreturnpro.com.au/auth/forgot-password
2. Enter your email address
3. Click "Send reset email"
4. Check your email for the reset link
5. Follow the link and set a new password

## Troubleshooting

### Database Connection Issues
- Error: "User not found" or connection timeouts
- Solution: Verify DATABASE_URL password is correct
- Check: Application logs for "P1001" or connection errors

### Email Not Sending
- Error: No reset emails received
- Solution: 
  1. Verify SENDGRID_API_KEY starts with "SG."
  2. Ensure EMAIL_FROM is a verified sender in SendGrid
  3. Check SendGrid dashboard for blocked emails

### Login Failures
- Error: "Invalid credentials" when password is correct
- Solution: 
  1. Ensure NEXTAUTH_SECRET is exactly as generated
  2. Check all environment variables are saved
  3. Redeploy if necessary

### Session Issues
- Error: Getting logged out immediately
- Solution: Verify NEXTAUTH_URL matches your domain exactly

## Need Help?
If you encounter issues:
1. Check the application logs in DigitalOcean
2. Verify all environment variables are set correctly
3. Ensure the database password is correct
4. Check that SendGrid API key is valid