# Next Steps for TAAXDOG Compliance

## 1. Test Monitoring Scripts (Do This First!)

Before setting up automated monitoring, test that everything works:

```bash
./test-compliance-monitoring.sh
```

This will:
- Run each monitoring script once
- Show you any errors
- Create log files in the `logs/` directory

## 2. Set Up Automated Monitoring

### Option A: Using Cron (Traditional)

1. Open crontab:
   ```bash
   crontab -e
   ```

2. Copy and paste all the cron entries from the manual setup script output

3. Save and exit (`:wq` in vim)

4. Verify:
   ```bash
   crontab -l
   ```

### Option B: Using PM2 (Recommended for Production)

1. Install PM2:
   ```bash
   npm install -g pm2
   ```

2. Start with the ecosystem file:
   ```bash
   pm2 start ecosystem.config.js
   ```

3. Save PM2 configuration:
   ```bash
   pm2 save
   pm2 startup
   # Follow the command it outputs
   ```

4. Check status:
   ```bash
   pm2 status
   pm2 logs
   ```

## 3. Configure Production APIs (When Ready)

### Quick Start for APIs:

1. **ABN Lookup (1 day)**
   - Go to: https://abr.business.gov.au/Tools/WebServices
   - Register with your ABN
   - Get GUID via email
   - Add to `.env`: `ABN_LOOKUP_GUID=your-guid`

2. **AUSTRAC (2-3 weeks)**
   - Register at: https://www.austrac.gov.au/business/enrol-reporting-entity
   - Get Entity ID
   - Request API access
   - Add to `.env`:
     ```
     AUSTRAC_API_KEY=your-key
     AUSTRAC_ENTITY_ID=your-id
     ```

3. **Switch to Production Mode**
   ```bash
   # In .env
   COMPLIANCE_TEST_MODE=false
   ```

## 4. Monitor Your System

### Daily Checks:
- Review logs: `ls -la logs/`
- Check for alerts: `npm run compliance:check-alerts`
- View recent AML flags: Check database or admin dashboard

### Weekly Tasks:
- Review compliance summary
- Check backup status
- Verify cron/PM2 is running

### Monthly Tasks:
- Review compliance report (generated automatically on 1st)
- Update any changed thresholds
- Train new staff if needed

## 5. Test Everything is Working

### Manual Test Commands:
```bash
# Test individual features
npm run compliance:aml        # Should check recent transactions
npm run compliance:privacy    # Should check consents
npm run compliance:apra       # Should verify system health

# Check system status
npx ts-node --project tsconfig.node.json scripts/test-compliance-features.ts
```

### Check Logs:
```bash
# View recent logs
tail -f logs/compliance-all.log
tail -f logs/aml-monitoring.log

# Check for errors
grep -i error logs/*.log
```

## Quick Reference

### 📁 Important Files:
- `.env` - Your configuration
- `logs/` - All monitoring output
- `compliance-reports/` - Monthly reports
- `ecosystem.config.js` - PM2 configuration

### 🔧 Useful Commands:
```bash
# Test compliance features
npm run test-compliance

# Run all checks manually
npm run compliance:all

# Generate monthly report manually
npm run compliance:monthly-report

# Check for critical alerts
npm run compliance:check-alerts
```

### 📚 Documentation:
- Admin procedures: `docs/ADMIN_COMPLIANCE_TRAINING.md`
- API setup: `PRODUCTION_API_SETUP.md`
- Feature overview: `docs/COMPLIANCE.md`

## Need Help?

1. Check logs first: `logs/` directory
2. Run test script: `./test-compliance-monitoring.sh`
3. Review documentation in `docs/`
4. Check `.env` configuration

---

Remember: The system is currently in **TEST MODE**. External API calls are disabled until you set `COMPLIANCE_TEST_MODE=false` and add real API credentials.