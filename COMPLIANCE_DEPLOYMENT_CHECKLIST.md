# TAAXDOG Compliance Features - Deployment Checklist

## Pre-Deployment

- [ ] **Review Documentation**
  - [ ] Read `docs/COMPLIANCE.md` for feature overview
  - [ ] Read `docs/COMPLIANCE_ENV_SETUP.md` for API setup
  - [ ] Read `docs/ADMIN_COMPLIANCE_TRAINING.md` for operations

- [ ] **Environment Setup**
  - [ ] Copy compliance variables from `.env.compliance.example` to `.env`
  - [ ] Set `COMPLIANCE_TEST_MODE=true` for initial testing
  - [ ] Configure AWS region to `ap-southeast-2` (Sydney)

## Database Migration

- [ ] **Apply Migration**

  ```bash
  # For production database
  psql -U <username> -h <host> -d <database> -f apply-compliance-migration.sql
  ```

- [ ] **Verify Tables Created**
  - [ ] aml_transaction_monitoring
  - [ ] privacy_consents
  - [ ] data_access_requests
  - [ ] apra_incident_reports
  - [ ] gst_transaction_details
  - [ ] compliance_configuration

- [ ] **Update Prisma**
  ```bash
  npx prisma migrate resolve --applied 20250118_add_compliance_features
  npx prisma generate
  ```

## Testing

- [ ] **Run Compliance Tests**

  ```bash
  npm run test-compliance
  # or
  ts-node scripts/test-compliance-features.ts
  ```

- [ ] **Test Each Module**
  - [ ] GST calculation endpoint: `POST /api/compliance/gst/calculate`
  - [ ] ABN validation: `POST /api/compliance/gst/validate-abn`
  - [ ] Privacy consent: `GET /api/compliance/privacy/consent`
  - [ ] System health: `GET /api/compliance/apra/data-residency`

## External API Setup

- [ ] **AUSTRAC (AML/CTF)**
  - [ ] Register as reporting entity
  - [ ] Obtain API credentials
  - [ ] Test with sandbox environment
  - [ ] Update `AUSTRAC_API_KEY` and `AUSTRAC_ENTITY_ID`

- [ ] **ABN Lookup**
  - [ ] Register at https://abr.business.gov.au/Tools/WebServices
  - [ ] Receive GUID via email
  - [ ] Update `ABN_LOOKUP_GUID`

- [ ] **AWS (Data Storage)**
  - [ ] Create S3 bucket in Sydney region
  - [ ] Enable encryption with KMS
  - [ ] Update `COMPLIANCE_BACKUP_BUCKET`

## Cron Jobs

- [ ] **Install Monitoring Scripts**

  ```bash
  ./scripts/install-cron-jobs.sh
  ```

- [ ] **Verify Cron Installation**

  ```bash
  crontab -l | grep compliance
  ```

- [ ] **Create Log Directory**
  ```bash
  mkdir -p logs
  chmod 755 logs
  ```

## Production Configuration

- [ ] **Update Environment Variables**
  - [ ] Set `COMPLIANCE_TEST_MODE=false`
  - [ ] Set `NODE_ENV=production`
  - [ ] Configure real API credentials
  - [ ] Set notification emails

- [ ] **Configure Notifications**
  - [ ] Set `COMPLIANCE_TEAM_EMAIL`
  - [ ] Set `COMPLIANCE_ALERT_EMAIL`
  - [ ] Configure SendGrid or SMTP
  - [ ] Test email delivery

- [ ] **Security Review**
  - [ ] Ensure encryption keys are set
  - [ ] Verify HTTPS only
  - [ ] Check API rate limiting
  - [ ] Review access controls

## Admin Training

- [ ] **Train Admin Staff**
  - [ ] Provide training documentation
  - [ ] Conduct hands-on session
  - [ ] Review emergency procedures
  - [ ] Test alert response

- [ ] **Access Setup**
  - [ ] Grant ADMIN/SUPPORT roles
  - [ ] Enable two-factor authentication
  - [ ] Document access list

## Monitoring Setup

- [ ] **Configure Alerts**
  - [ ] High-risk AML transactions
  - [ ] Overdue privacy requests
  - [ ] APRA reporting deadlines
  - [ ] System health issues

- [ ] **Test Monitoring**
  ```bash
  npm run compliance:check-alerts
  ```

## Go-Live

- [ ] **Final Checks**
  - [ ] All tests passing
  - [ ] Cron jobs running
  - [ ] Alerts configured
  - [ ] Backups working

- [ ] **Enable Features**
  - [ ] Set `ENABLE_AML_MONITORING=true`
  - [ ] Set `ENABLE_PRIVACY_COMPLIANCE=true`
  - [ ] Set `ENABLE_APRA_COMPLIANCE=true`
  - [ ] Set `ENABLE_GST_COMPLIANCE=true`

- [ ] **Monitor First 24 Hours**
  - [ ] Check logs for errors
  - [ ] Verify cron execution
  - [ ] Review any alerts
  - [ ] Confirm backups

## Post-Deployment

- [ ] **First Week**
  - [ ] Daily log review
  - [ ] Address any issues
  - [ ] Fine-tune thresholds
  - [ ] Gather admin feedback

- [ ] **First Month**
  - [ ] Review monthly report
  - [ ] Analyze compliance metrics
  - [ ] Update procedures
  - [ ] Plan improvements

## Rollback Plan

If issues arise:

1. **Disable Features**

   ```bash
   # Set in .env
   ENABLE_AML_MONITORING=false
   ENABLE_PRIVACY_COMPLIANCE=false
   ENABLE_APRA_COMPLIANCE=false
   ENABLE_GST_COMPLIANCE=false
   ```

2. **Remove Cron Jobs**

   ```bash
   crontab -l | grep -v compliance | crontab -
   ```

3. **Keep Tables** (don't drop - contains audit data)

## Support Contacts

- **Internal**: compliance@taxreturnpro.com.au
- **AUSTRAC**: ict.support@austrac.gov.au
- **ABN Lookup**: https://abr.business.gov.au/Help
- **Emergency**: See `docs/ADMIN_COMPLIANCE_TRAINING.md`

---

**Deployment Date**: ******\_******  
**Deployed By**: ******\_******  
**Sign-off**: ******\_******
