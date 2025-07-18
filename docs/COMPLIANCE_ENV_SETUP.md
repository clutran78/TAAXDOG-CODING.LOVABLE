# Compliance Environment Variables Setup Guide

This guide explains how to configure environment variables for Australian financial compliance features.

## Overview

The compliance features require integration with various Australian regulatory APIs and services. This document provides detailed instructions for obtaining and configuring the necessary credentials.

## 1. AUSTRAC Integration (AML/CTF)

### Obtaining AUSTRAC API Credentials

1. **Register as a Reporting Entity**
   - Visit: https://www.austrac.gov.au/business/enrol-reporting-entity
   - Complete the enrollment process
   - Receive your Reporting Entity ID

2. **API Access**
   - Contact AUSTRAC ICT Support: ict.support@austrac.gov.au
   - Request API access for automated SMR/TTR submission
   - Complete security assessment
   - Receive API credentials

### Configuration
```bash
AUSTRAC_API_URL=https://api.austrac.gov.au/v1
AUSTRAC_API_KEY=<your-api-key>
AUSTRAC_ENTITY_ID=<your-entity-id>
```

### Testing
- Use AUSTRAC's test environment first
- Test URL: https://test-api.austrac.gov.au/v1
- Test credentials provided during onboarding

## 2. ABN Lookup Integration (GST/Tax)

### Obtaining ABN Lookup GUID

1. **Register for Web Services**
   - Visit: https://abr.business.gov.au/Tools/WebServices
   - Register your application
   - Agree to terms of use

2. **Receive GUID**
   - GUID sent via email within 1 business day
   - Valid for production use immediately

### Configuration
```bash
ABN_LOOKUP_URL=https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx
ABN_LOOKUP_GUID=<your-guid>
```

### Usage Limits
- 1,000 lookups per day (free tier)
- Upgrade available for higher volumes

## 3. APRA Integration

### APRA Connect Setup

1. **Register for APRA Connect**
   - Email: apra.statistics@apra.gov.au
   - Provide entity details
   - Complete onboarding process

2. **API Credentials**
   - Receive credentials via secure channel
   - Configure certificate-based authentication

### Configuration
```bash
APRA_REPORTING_ENDPOINT=https://api.apra.gov.au/incident-reports
APRA_API_KEY=<your-api-key>
APRA_CERTIFICATE_PATH=/path/to/cert.pem
```

## 4. AWS Configuration (Data Residency)

### Sydney Region Setup

```bash
# MUST use Sydney region for compliance
AWS_REGION=ap-southeast-2
AWS_DEFAULT_REGION=ap-southeast-2

# S3 Bucket Configuration
COMPLIANCE_BACKUP_BUCKET=your-bucket-name
COMPLIANCE_KMS_KEY_ID=arn:aws:kms:ap-southeast-2:account:key/xxx
```

### Creating Compliant S3 Bucket
```bash
# Create bucket in Sydney
aws s3 mb s3://your-bucket-name --region ap-southeast-2

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket your-bucket-name \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "your-kms-key-id"
      }
    }]
  }'

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

## 5. Notification Services

### SendGrid Setup (Recommended)
```bash
SENDGRID_API_KEY=<your-sendgrid-key>
COMPLIANCE_FROM_EMAIL=compliance@yourdomain.com.au
COMPLIANCE_TEAM_EMAIL=compliance-team@yourdomain.com.au
```

### Slack Webhooks (Optional)
1. Create incoming webhook: https://api.slack.com/messaging/webhooks
2. Choose compliance channel
3. Copy webhook URL

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
SLACK_COMPLIANCE_CHANNEL=#compliance-alerts
```

## 6. Security Keys

### Generating Encryption Keys
```bash
# Generate 256-bit encryption key
openssl rand -base64 32

# Generate signing key
openssl rand -base64 64
```

### Configuration
```bash
DATA_ENCRYPTION_KEY=<base64-encoded-key>
DATA_SIGNING_KEY=<base64-encoded-key>
```

## 7. Development vs Production

### Development Environment
```bash
# .env.development
COMPLIANCE_TEST_MODE=true
AUSTRAC_API_URL=https://test-api.austrac.gov.au/v1
ENABLE_AML_MONITORING=true
ENABLE_PRIVACY_COMPLIANCE=true
ENABLE_APRA_COMPLIANCE=false  # May disable in dev
ENABLE_GST_COMPLIANCE=true
```

### Production Environment
```bash
# .env.production
COMPLIANCE_TEST_MODE=false
AUSTRAC_API_URL=https://api.austrac.gov.au/v1
ENABLE_AML_MONITORING=true
ENABLE_PRIVACY_COMPLIANCE=true
ENABLE_APRA_COMPLIANCE=true
ENABLE_GST_COMPLIANCE=true
```

## 8. Monitoring Setup

### DataDog (Optional)
```bash
DATADOG_API_KEY=<your-api-key>
DATADOG_APP_KEY=<your-app-key>
DATADOG_COMPLIANCE_TAGS=env:production,service:compliance,region:au
```

### Sentry (Optional)
```bash
SENTRY_DSN=https://xxx@o123.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

## 9. Validation Checklist

Before going to production, ensure:

- [ ] All API credentials are valid and tested
- [ ] Data residency configured for Sydney region
- [ ] Encryption keys are securely stored
- [ ] Backup bucket has encryption enabled
- [ ] Notification channels are tested
- [ ] Rate limits are appropriate
- [ ] Monitoring is configured
- [ ] Test mode is disabled

## 10. Secret Management

### Using AWS Secrets Manager (Recommended)
```javascript
// Example: Retrieve secrets in production
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({ region: 'ap-southeast-2' });

async function getSecret(secretName) {
  const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
  return JSON.parse(data.SecretString);
}

// Usage
const secrets = await getSecret('taaxdog/compliance/production');
process.env.AUSTRAC_API_KEY = secrets.AUSTRAC_API_KEY;
```

### Using HashiCorp Vault (Alternative)
```bash
# Store secrets
vault kv put secret/taaxdog/compliance \
  austrac_api_key="xxx" \
  abn_lookup_guid="yyy"

# Retrieve in application
vault kv get -format=json secret/taaxdog/compliance
```

## Support

For assistance with compliance integrations:

- **AUSTRAC**: ict.support@austrac.gov.au
- **ABN Lookup**: https://abr.business.gov.au/Help/WebServicesSupport
- **APRA**: apra.statistics@apra.gov.au
- **Internal**: compliance@taxreturnpro.com.au