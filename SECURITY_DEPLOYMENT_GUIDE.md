# Security Deployment Guide

## Current Status

### ✅ Completed
- RLS migration applied to database
- Encryption key generated and configured
- 29 API routes successfully migrated to RLS
- Field-level encryption implemented
- All security tests passing (6/6)

### 🔄 Pending
- Apply migrated files to replace originals
- Complete migration of remaining API routes
- Deploy to production environment

## Step-by-Step Deployment

### 1. Pre-Deployment Backup (CRITICAL)
```bash
# Backup your code
git add .
git commit -m "Pre-RLS deployment backup"
git push

# Backup production database
pg_dump $PRODUCTION_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Apply All Migrations Locally
```bash
# Apply all RLS migrations at once
./scripts/apply-all-migrations.sh

# Or review and apply selectively
npx ts-node scripts/review-and-apply-migrations.ts
```

### 3. Test Locally
```bash
# Start development server
npm run dev

# Run security tests
npm run test-rls
npx ts-node scripts/test-security-complete.ts

# Test key endpoints manually
curl http://localhost:3000/api/goals
curl http://localhost:3000/api/receipts
curl http://localhost:3000/api/auth/profile
```

### 4. Production Environment Setup

#### Add to Production Environment Variables:
```bash
FIELD_ENCRYPTION_KEY=833895a4497a122eefa3a05dc90285dfbe720e5bb1a19e334e618ccb79389dbb
```

⚠️ **IMPORTANT**: Store this key securely in:
- DigitalOcean App Platform environment variables
- Password manager (1Password, LastPass, etc.)
- Secure key management service

### 5. Deploy to Production

#### Option A: DigitalOcean App Platform
1. Go to your app in DigitalOcean console
2. Add `FIELD_ENCRYPTION_KEY` to environment variables
3. Deploy the updated code
4. Monitor deployment logs

#### Option B: Manual Deployment
```bash
# On production server
git pull origin main
npm install
npm run build
pm2 restart all
```

### 6. Post-Deployment Verification
```bash
# SSH to production
ssh root@170.64.206.137

# Run production tests
NODE_ENV=production npm run test-security-complete

# Check application logs
pm2 logs

# Monitor for errors
tail -f /var/log/nginx/error.log
```

### 7. Encrypt Existing Production Data
```bash
# Only if you have sensitive data to encrypt
NODE_ENV=production npx ts-node scripts/encrypt-existing-data.ts
```

## Rollback Plan

If issues occur:

### Quick Rollback (< 5 minutes)
```bash
# Rollback code changes
./scripts/rollback-migrations.sh
git checkout HEAD~1
npm run build
pm2 restart all
```

### Database Rollback (if needed)
```sql
-- Disable RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipts DISABLE ROW LEVEL SECURITY;
-- Continue for other tables...
```

## Monitoring Checklist

### First Hour
- [ ] Check application logs for errors
- [ ] Monitor response times
- [ ] Verify user authentication works
- [ ] Test data access (users see only their data)
- [ ] Check admin access works

### First Day
- [ ] Monitor performance metrics
- [ ] Check for RLS policy violations in logs
- [ ] Verify encryption/decryption working
- [ ] Review error rates
- [ ] Test all major features

### First Week
- [ ] Run performance analysis
- [ ] Review security logs
- [ ] Check database query performance
- [ ] Gather user feedback
- [ ] Plan any optimizations

## Performance Monitoring

```bash
# Monitor RLS performance
npx ts-node scripts/monitor-rls-performance.ts

# Check slow queries
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements WHERE mean_exec_time > 100 ORDER BY mean_exec_time DESC LIMIT 10;"

# Monitor application metrics
pm2 monit
```

## Security Verification

```bash
# Run comprehensive security check
npx ts-node scripts/test-security-complete.ts

# Verify RLS is active
psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;"

# Test data isolation
# Create two test users and verify they cannot see each other's data
```

## Success Criteria

✅ Deployment is successful when:
1. All API endpoints respond normally
2. Users can only access their own data
3. Admin users can access all data
4. No performance degradation > 10%
5. No security test failures
6. Error rate remains below 1%

## Support Contacts

- **Technical Issues**: Check logs and rollback if needed
- **Security Concerns**: Review RLS policies and audit logs
- **Performance Problems**: Check indexes and query plans

## Next Steps After Deployment

1. **Week 1**: Monitor closely, gather metrics
2. **Week 2**: Optimize any slow queries
3. **Month 1**: First security audit
4. **Quarter 1**: Plan key rotation

---

Remember: Security is an ongoing process. Regular monitoring and updates are essential for maintaining a secure system.