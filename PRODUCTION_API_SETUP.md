# Production API Configuration Guide

## Overview

This guide walks you through obtaining and configuring production API
credentials for TAAXDOG's compliance features.

## 1. AUSTRAC API (AML/CTF Compliance)

### Step 1: Register as a Reporting Entity

1. Visit: https://www.austrac.gov.au/business/enrol-reporting-entity
2. Complete the enrollment form with:
   - Business details (ABN, ACN)
   - Principal contact information
   - Business activities (financial services)
   - Compliance officer details

3. Wait for approval (typically 5-10 business days)
4. You'll receive your **Reporting Entity ID** via email

### Step 2: Request API Access

1. Email: ict.support@austrac.gov.au
2. Subject: "API Access Request - [Your Business Name]"
3. Include:
   - Reporting Entity ID
   - Technical contact details
   - Intended use (automated SMR/TTR submission)
   - Expected transaction volume

4. Complete security assessment questionnaire
5. Receive API credentials (typically 2-3 weeks)

### Step 3: Update Configuration

```bash
# Edit your .env file
AUSTRAC_API_URL=https://api.austrac.gov.au/v1
AUSTRAC_API_KEY=your-production-api-key-here
AUSTRAC_ENTITY_ID=your-reporting-entity-id
```

### Step 4: Test Integration

```bash
# Test with a single transaction
curl -X POST https://api.austrac.gov.au/v1/test \
  -H "Authorization: Bearer $AUSTRAC_API_KEY" \
  -H "Content-Type: application/json"
```

## 2. ABN Lookup API

### Step 1: Register for Web Services

1. Visit: https://abr.business.gov.au/Tools/WebServices
2. Click "Register for ABN Lookup web services"
3. Complete registration:
   - Your ABN
   - Contact details
   - Intended use description
   - Expected volume

4. Accept terms of use
5. GUID sent via email within 1 business day

### Step 2: Update Configuration

```bash
# Edit your .env file
ABN_LOOKUP_GUID=your-guid-here
```

### Step 3: Test ABN Lookup

```bash
# Test ABN validation
npm run test-abn-lookup

# Or use curl
curl "https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/ABRSearchByABN?searchString=51824753556&includeHistoricalDetails=N&authenticationGuid=$ABN_LOOKUP_GUID"
```

## 3. Production Environment Variables

### Complete Production Configuration

```bash
# ===========================
# Production Compliance Settings
# ===========================

# Set to production mode
COMPLIANCE_TEST_MODE=false
NODE_ENV=production

# AUSTRAC Production API
AUSTRAC_API_URL=https://api.austrac.gov.au/v1
AUSTRAC_API_KEY=your-production-austrac-key
AUSTRAC_ENTITY_ID=your-entity-id

# ABN Lookup Production
ABN_LOOKUP_GUID=your-production-guid

# Production Thresholds (don't change unless advised)
AML_CASH_THRESHOLD=10000
AML_INTERNATIONAL_THRESHOLD=1000
AML_HIGH_RISK_SCORE=0.75
AML_MEDIUM_RISK_SCORE=0.50

# Production Notifications
COMPLIANCE_TEAM_EMAIL=compliance@yourdomain.com.au
COMPLIANCE_ALERT_EMAIL=alerts@yourdomain.com.au
COMPLIANCE_FROM_EMAIL=noreply@yourdomain.com.au

# Production Email Service (SendGrid recommended)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key

# Production Backup Storage
AWS_REGION=ap-southeast-2
COMPLIANCE_BACKUP_BUCKET=your-compliance-backups
COMPLIANCE_KMS_KEY_ID=arn:aws:kms:ap-southeast-2:account:key/xxx

# Optional: Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_COMPLIANCE_CHANNEL=#compliance-alerts

# Optional: SMS Alerts for Critical Issues
SMS_API_KEY=your-twilio-or-similar-key
COMPLIANCE_ALERT_PHONE=+61400000000
```

## 4. Pre-Production Checklist

Before switching to production mode:

- [ ] **Test all integrations** in test mode first
- [ ] **Verify API credentials** are valid
- [ ] **Configure email notifications** and test delivery
- [ ] **Set up backup storage** in AWS S3 Sydney region
- [ ] **Train admin staff** on compliance procedures
- [ ] **Review thresholds** with compliance officer
- [ ] **Document API credentials** securely
- [ ] **Set up monitoring alerts**
- [ ] **Create incident response plan**
- [ ] **Schedule compliance review meetings**

## 5. Switching to Production

### Step 1: Update Environment

```bash
# Update .env file
COMPLIANCE_TEST_MODE=false
```

### Step 2: Restart Application

```bash
# For PM2
pm2 restart taaxdog

# For systemd
sudo systemctl restart taaxdog

# For Docker
docker-compose restart app
```

### Step 3: Verify Production Mode

```bash
# Check compliance status
npm run compliance:check-status

# Should show:
# - Test Mode: false
# - External APIs: enabled
# - Monitoring: active
```

### Step 4: Monitor First 24 Hours

1. Check logs every 4 hours
2. Review any AML alerts
3. Verify API calls are successful
4. Check email notifications are delivered
5. Monitor error rates

## 6. API Usage Limits

### AUSTRAC API

- Rate limit: 100 requests/minute
- Daily limit: None
- Batch submissions supported (up to 100 reports)

### ABN Lookup API

- Free tier: 1,000 lookups/day
- Paid tier: Contact ATO for higher volumes
- Rate limit: 10 requests/second

## 7. Troubleshooting

### AUSTRAC API Issues

**Error: 401 Unauthorized**

- Check API key is correct
- Verify entity ID matches registration
- Ensure production URL is used

**Error: 429 Too Many Requests**

- Implement rate limiting
- Use batch submissions
- Contact AUSTRAC for higher limits

### ABN Lookup Issues

**Error: Invalid GUID**

- Verify GUID copied correctly
- Check no extra spaces
- Ensure not using test GUID in production

**Error: Daily limit exceeded**

- Implement caching for ABN lookups
- Consider paid tier for higher volume
- Spread lookups throughout the day

## 8. Support Contacts

### AUSTRAC Support

- Email: ict.support@austrac.gov.au
- Phone: 1300 021 037
- Hours: Mon-Fri 9am-5pm AEST

### ABN Lookup Support

- Web: https://abr.business.gov.au/Help/WebServicesSupport
- Email: abr@ato.gov.au
- Phone: 13 72 26

### Internal Support

- Compliance: compliance@yourdomain.com.au
- Technical: dev@yourdomain.com.au
- Emergency: [Your emergency contact]

## 9. Regular Maintenance

### Monthly Tasks

- Review API usage statistics
- Check for API updates/changes
- Verify backup processes
- Review compliance reports
- Update API documentation

### Quarterly Tasks

- Renew API credentials if required
- Review and update thresholds
- Compliance training refresh
- Security audit of API keys
- Test disaster recovery

## 10. Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for all credentials
3. **Rotate API keys** quarterly
4. **Monitor for unauthorized usage**
5. **Use IP whitelisting** where available
6. **Enable API request logging**
7. **Set up alerts** for unusual activity
8. **Document all API access**
9. **Use secure key storage** (AWS Secrets Manager, etc.)
10. **Regular security audits**

---

**Last Updated**: January 2025 **Next Review**: April 2025
