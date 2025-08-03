# 🚨 EMERGENCY ROLLBACK GUIDE

## ⚡ Quick Recovery Commands

If something breaks and you need to restore the working PostgreSQL state:

### 1. Immediate Rollback (30 seconds)

```bash
# Checkout the stable milestone
git checkout v1.0.0-postgresql-migration

# Create emergency branch
git checkout -b emergency/restore-working-state

# Push to trigger new deployment
git push origin emergency/restore-working-state
```

### 2. Deploy Emergency Branch

1. Go to DigitalOcean App Platform
2. Change deployment branch from `main` to `emergency/restore-working-state`
3. Trigger manual deployment
4. **Working state restored!**

## 🔍 What This Rollback Includes

### ✅ Restored Functionality

- ✅ User login/logout working
- ✅ Password reset functional
- ✅ Dashboard with all data
- ✅ Banking integration active
- ✅ All CRUD operations working
- ✅ PostgreSQL database connected
- ✅ Authentication flow complete

### 📋 Rollback State Details

- **Commit:** `0c85e32`
- **Date:** January 3, 2025
- **Status:** Fully functional PostgreSQL app
- **Last Working:** All authentication and core features

## 🛠️ After Emergency Rollback

### Step 1: Identify What Broke

```bash
# Compare current main with working state
git diff v1.0.0-postgresql-migration main

# Check recent commits since milestone
git log v1.0.0-postgresql-migration..main --oneline
```

### Step 2: Test in Development

```bash
# Create fix branch from working state
git checkout v1.0.0-postgresql-migration
git checkout -b fix/restore-main-branch

# Apply fixes one by one
# Test each change
# Only proceed when confirmed working
```

### Step 3: Safe Return to Main

```bash
# When fixes confirmed working:
git checkout main
git reset --hard v1.0.0-postgresql-migration
git cherry-pick <only-the-safe-commits>
git push origin main --force-with-lease
```

## 🚫 DO NOT DO These During Emergency

- ❌ Don't make database schema changes
- ❌ Don't modify auth configuration
- ❌ Don't change environment variables
- ❌ Don't update major dependencies
- ❌ Don't force push without backup

## 📞 Emergency Checklist

When something breaks:

- [ ] Can users log in? If NO → Emergency rollback immediately
- [ ] Is dashboard loading? If NO → Emergency rollback immediately
- [ ] Are API calls working? If NO → Check recent changes first
- [ ] Is database connected? If NO → Check environment variables

## 🎯 Prevention Guidelines

### Before Making ANY Changes:

1. **Create branch** from current main
2. **Test locally** thoroughly
3. **Small commits** with clear messages
4. **Test on staging** before production
5. **Monitor deployment** after push

### Safe Areas to Modify:

- ✅ UI components (non-auth)
- ✅ New API endpoints (non-auth)
- ✅ Styling and CSS
- ✅ Documentation
- ✅ Business logic (non-breaking)

### DANGER ZONES (Extra Care):

- ⚠️ Authentication files (`lib/auth.ts`)
- ⚠️ Middleware (`src/middleware.ts`)
- ⚠️ Database schema (`prisma/schema.prisma`)
- ⚠️ Auth routes (`src/app/api/auth/*`)
- ⚠️ Environment configuration

## 📊 Health Check Commands

Test if rollback was successful:

```bash
# Test login API
curl -X POST https://dev.taxreturnpro.com.au/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test dashboard API
curl https://dev.taxreturnpro.com.au/api/dashboard \
  -H "Cookie: next-auth.session-token=..."

# Check database connectivity
curl https://dev.taxreturnpro.com.au/api/health
```

## 🔄 Recovery Success Indicators

✅ **Rollback Successful When:**

- Users can log in without errors
- Dashboard loads with data
- "Forgot Password" sends emails
- No console errors on login page
- PostgreSQL queries executing normally

---

**Remember:** This milestone took significant effort to achieve.  
**Always prefer rollback over attempting live fixes.**  
**Better to lose recent changes than lose the working foundation.**
