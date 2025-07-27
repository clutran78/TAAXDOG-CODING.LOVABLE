# TAAXDOG Deployment Checklist

## Overview

This checklist ensures safe and consistent deployments to DigitalOcean App
Platform.

## Pre-Deployment Checklist

### 1. Code Quality

- [ ] Run linter: `npm run lint`
- [ ] Run type checking: `npm run build` (includes TypeScript compilation)
- [ ] Run tests (if available): `npm test`
- [ ] Verify no hardcoded secrets in code

### 2. Database Verification

- [ ] Test database connection: `npm run test-db`
- [ ] Ensure migrations are up to date: `npx prisma migrate status`
- [ ] Generate latest Prisma client: `npx prisma generate`

### 3. Environment Configuration

- [ ] Verify all required environment variables are set in DigitalOcean App
      Platform
- [ ] Ensure using `app.yaml` (NOT `digitalocean-app-spec.yaml` which contains
      hardcoded secrets)
- [ ] Confirm production database URL is correct

### 4. Git Status

- [ ] Ensure on `main` branch: `git branch --show-current`
- [ ] Check for uncommitted changes: `git status`
- [ ] Pull latest changes: `git pull origin main`

## Deployment Process

### Automatic Deployment (Recommended)

1. Commit your changes:

   ```bash
   git add .
   git commit -m "feat: Your descriptive commit message"
   ```

2. Push to main branch:

   ```bash
   git push origin main
   ```

3. DigitalOcean will automatically:
   - Detect the push to main branch
   - Run the build command: `npm run build:do`
   - Deploy the application
   - Send alerts if deployment fails

### Manual Deployment (If needed)

1. Log into DigitalOcean Dashboard
2. Navigate to Apps > taaxdog-production
3. Click "Deploy" button
4. Select the commit to deploy

## Post-Deployment Verification

### 1. Application Health

- [ ] Visit https://taxreturnpro.com.au
- [ ] Check application loads correctly
- [ ] Test login functionality
- [ ] Verify Stripe integration (test mode first)

### 2. Monitor Deployment

- [ ] Check DigitalOcean App Platform logs
- [ ] Monitor for any deployment alerts
- [ ] Verify database connections are stable

### 3. Quick Functionality Tests

- [ ] User registration/login works
- [ ] Database queries execute properly
- [ ] AI features respond correctly
- [ ] Banking integration (if applicable) functions

## Rollback Procedure

If issues occur after deployment:

1. **Quick Rollback via DigitalOcean:**
   - Go to App Platform dashboard
   - Click on "Activity" tab
   - Find the previous successful deployment
   - Click "Rollback to this deployment"

2. **Git Rollback (if needed):**

   ```bash
   # Find the last known good commit
   git log --oneline -10

   # Revert to that commit
   git revert HEAD
   git push origin main
   ```

## Security Reminders

1. **NEVER commit secrets to the repository**
2. **Always use environment variables for sensitive data**
3. **Use `app.yaml` for deployment (uses env var references)**
4. **Delete `digitalocean-app-spec.yaml` or move secrets to env vars**

## Environment Variables Required

All these must be set in DigitalOcean App Platform settings:

- NEXTAUTH_SECRET
- JWT_SECRET_KEY
- DATABASE_URL
- STRIPE_PUBLISHABLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- ANTHROPIC_API_KEY
- OPENROUTER_API_KEY
- GEMINI_API_KEY
- BASIQ_API_KEY
- SENDGRID_API_KEY
- NEXT*PUBLIC_FIREBASE*\* (multiple keys)

## Monitoring

- **Deployment Status**: https://cloud.digitalocean.com/apps
- **Domain Status**: Verify taxreturnpro.com.au resolves correctly
- **SSL Certificate**: Should auto-renew via DigitalOcean

## Support Contacts

- DigitalOcean Support: https://www.digitalocean.com/support/
- Domain Issues: Check with your domain registrar
- Application Issues: Check application logs in DigitalOcean dashboard
