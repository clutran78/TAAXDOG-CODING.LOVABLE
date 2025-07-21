# Production Authentication Fix - Complete Guide

## Changes Made

1. **Fixed Prisma Client Generation**
   - Changed from custom path `../generated/prisma` to default `@prisma/client`
   - Updated `lib/prisma.ts` to use standard import
   - Added `postinstall` script to auto-generate on deployment

2. **Removed Standalone Configuration**
   - Removed `output: 'standalone'` from `next.config.js`
   - This fixes the "next start" warning in production

3. **Enhanced Error Logging**
   - Added detailed error logging to registration endpoint
   - Added request tracking and timestamp logging
   - Better error categorization for debugging

4. **Created Diagnostic Tools**
   - `scripts/verify-production-db.js` - Test database connection and schema
   - `/api/auth/test-registration` - Test endpoint for diagnostics

## Deployment Steps

### 1. Commit and Push Changes
```bash
git add -A
git commit -m "Fix authentication for production deployment"
git push origin main
```

### 2. Update Environment Variables in DigitalOcean

Ensure these are set in your App Platform:
```
DATABASE_URL=[copy from .env.local]
NEXTAUTH_URL=https://taxreturnpro.com.au
NEXTAUTH_SECRET=[generate with: openssl rand -base64 32]
NODE_ENV=production
```

### 3. Trigger New Deployment

The build will now:
- Run `npm install` (which triggers `prisma generate`)
- Run `npm run build` (which runs `prisma generate && next build`)
- Start with `npm start`

### 4. Verify After Deployment

1. Check logs for any Prisma errors
2. Test registration: https://taxreturnpro.com.au/auth/register
3. Test diagnostics: https://taxreturnpro.com.au/api/auth/test-registration

## Troubleshooting

### If Registration Still Fails:

1. **Check Production Logs**
   - Look for "Registration request received" messages
   - Check for detailed error logs with timestamps

2. **Run Database Verification**
   ```bash
   NODE_ENV=production DATABASE_URL=[your-prod-url] node scripts/verify-production-db.js
   ```

3. **Common Issues**
   - **"Cannot find module '@prisma/client'"**: Prisma didn't generate during build
   - **"P2025 error"**: Schema mismatch - run migrations
   - **"Connection error"**: DATABASE_URL is incorrect

### Database Schema Issues

If the production database schema doesn't match:
```bash
# Generate migration files
npx prisma migrate dev --name fix_schema

# Apply to production (carefully!)
DATABASE_URL=[prod-url] npx prisma migrate deploy
```

## Testing Authentication Flow

1. **Registration Test**
   ```bash
   curl -X POST https://taxreturnpro.com.au/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'
   ```

2. **Check Logs**
   - Should see "Registration request received"
   - Should see either success or detailed error

3. **Login Test**
   ```bash
   curl -X POST https://taxreturnpro.com.au/api/auth/[...nextauth] \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}'
   ```

## Next Steps

After deployment:
1. Monitor logs for 5-10 minutes
2. Test all auth endpoints
3. Check database for new user records
4. Verify password reset flow

## Support

If issues persist after following these steps:
1. Check DigitalOcean App Platform logs
2. Run the diagnostic endpoint
3. Verify all environment variables are set
4. Check database connectivity from production server