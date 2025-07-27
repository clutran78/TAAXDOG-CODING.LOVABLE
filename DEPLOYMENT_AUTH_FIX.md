# Authentication Fix for Production Deployment

## Issue

Authentication (login, register, password reset) is not working in production.

## Root Causes

1. Missing or incorrect environment variables
2. Database connection issues
3. NextAuth configuration problems

## Quick Fix Steps

### 1. Set Environment Variables in DigitalOcean App Platform

Go to your app settings and add these environment variables:

```bash
# REQUIRED - Copy exact values from .env.local
DATABASE_URL=postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require

# REQUIRED - Your production URL
NEXTAUTH_URL=https://taxreturnpro.com.au

# REQUIRED - Generate a secure secret
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

# REQUIRED
NODE_ENV=production
```

### 2. Generate NEXTAUTH_SECRET

Run this command locally to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and use it as your NEXTAUTH_SECRET value.

### 3. Update Your Deployment

After setting environment variables:

1. Redeploy your application
2. Check the logs for any errors
3. Test authentication at: https://taxreturnpro.com.au/auth/login

### 4. Verify Database Connection

The error logs show the database is connecting, but ensure:

- The DATABASE_URL is exactly as shown in .env.local
- SSL mode is set to 'require'
- The database is accessible from your deployment region

### 5. Test Authentication

Test in this order:

1. Registration: https://taxreturnpro.com.au/auth/register
2. Login: https://taxreturnpro.com.au/auth/login
3. Password Reset: https://taxreturnpro.com.au/auth/forgot-password

## Debugging Commands

Run locally to test your production database:

```bash
NODE_ENV=production node scripts/fix-auth-production.js
```

## Common Issues and Solutions

### "User not found" errors

- Database is connected but tables might be missing
- Solution: Run migrations on production database

### "Invalid credentials" on login

- Password hashing mismatch
- Solution: Ensure bcrypt rounds match (we use 12)

### Password reset not working

- Missing passwordResetToken/passwordResetExpires columns
- Solution: Check database schema matches local

## Emergency Rollback

If issues persist:

1. Revert to previous deployment
2. Check all environment variables are set
3. Verify database connectivity
4. Contact support with error logs
