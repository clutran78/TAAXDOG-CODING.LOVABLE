# Security Deployment Checklist

## Pre-Deployment

### 1. Environment Setup ✅
- [x] Generate encryption key
- [x] Add `FIELD_ENCRYPTION_KEY` to `.env`
- [ ] Add `FIELD_ENCRYPTION_KEY` to production environment variables
- [ ] Verify encryption key is 64 characters (32 bytes hex)

### 2. Database Preparation ✅
- [x] Apply RLS migration to database
- [x] Verify RLS is enabled on all sensitive tables
- [x] Verify RLS policies are created
- [x] Verify performance indexes are created

### 3. Code Updates
- [x] Update `prisma-rls.ts` to include encryption middleware
- [ ] Migrate all API routes to use RLS middleware
  - [x] Goals API (`/api/goals/*`)
  - [x] Receipts API (`/api/receipts/*`) 
  - [ ] Budgets API (`/api/budgets/*`)
  - [ ] Banking API (`/api/banking/*`)
  - [ ] AI API (`/api/ai/*`)
  - [ ] Auth API (`/api/auth/*`)
  - [ ] Stripe API (`/api/stripe/*`)

### 4. Testing ✅
- [x] Run `npm run test-rls`
- [x] Run `npx ts-node scripts/test-encryption.ts`
- [x] Run `npx ts-node scripts/test-security-complete.ts`
- [ ] Test with multiple user accounts
- [ ] Test admin access
- [ ] Performance testing under load

## Deployment Steps

### 1. Backup
- [ ] Backup production database
- [ ] Document current encryption key (if any)
- [ ] Save rollback scripts

### 2. Deploy Database Changes
```bash
# Apply RLS migration
./scripts/apply-rls-migration.sh

# Verify RLS is active
npm run test-rls
```

### 3. Deploy Application
- [ ] Set `FIELD_ENCRYPTION_KEY` in production
- [ ] Deploy updated application code
- [ ] Restart application servers
- [ ] Clear any caches

### 4. Encrypt Existing Data
```bash
# Run encryption migration
npx ts-node scripts/encrypt-existing-data.ts --force
```

### 5. Verification
- [ ] Run security tests in production
- [ ] Verify users can only see their own data
- [ ] Test admin access works
- [ ] Check application logs for errors
- [ ] Monitor performance metrics

## Post-Deployment

### 1. Monitoring
- [ ] Set up alerts for RLS policy violations
- [ ] Monitor query performance
- [ ] Track failed decryption attempts
- [ ] Watch for unusual access patterns

### 2. Documentation
- [ ] Update API documentation
- [ ] Document encryption key in secure vault
- [ ] Update security procedures
- [ ] Train team on new security features

### 3. Compliance
- [ ] Document RLS implementation for auditors
- [ ] Update privacy policy if needed
- [ ] Verify GDPR/APP compliance
- [ ] Schedule security review

## Rollback Plan

If issues occur:

### 1. Disable RLS (Emergency)
```sql
-- Disable RLS on affected tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
-- etc.
```

### 2. Restore Original Code
- [ ] Deploy previous version without RLS middleware
- [ ] Remove encryption middleware from Prisma client
- [ ] Restore original API routes

### 3. Decrypt Data (if needed)
```bash
# Run decryption script
npx ts-node scripts/decrypt-all-data.ts
```

## Security Checklist

### Access Control
- [ ] RLS policies tested with different user roles
- [ ] Admin bypass verified
- [ ] No data leaks between users
- [ ] API endpoints properly secured

### Encryption
- [ ] Encryption key stored securely
- [ ] Sensitive fields encrypted in database
- [ ] Decryption working in application
- [ ] Key rotation plan in place

### Performance
- [ ] Query performance acceptable
- [ ] Indexes being used
- [ ] No significant latency increase
- [ ] Connection pool configured properly

### Operational
- [ ] Logging configured for security events
- [ ] Monitoring alerts set up
- [ ] Backup procedures updated
- [ ] Disaster recovery tested

## Sign-offs

- [ ] Development Team Lead
- [ ] Security Officer
- [ ] Database Administrator
- [ ] Operations Manager
- [ ] Compliance Officer

## Notes

_Add any deployment-specific notes here_

---

Last Updated: ${new Date().toISOString()}
Next Review: ${new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}