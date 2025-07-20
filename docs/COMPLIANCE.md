# Australian Financial Compliance Features

This document outlines the comprehensive Australian financial compliance features implemented in TAAXDOG.

## Overview

TAAXDOG implements full compliance with Australian financial regulations including:

- **AML/CTF**: Anti-Money Laundering and Counter-Terrorism Financing Act 2006
- **Privacy Act**: Privacy Act 1988 and Australian Privacy Principles (APPs)
- **APRA**: Australian Prudential Regulation Authority requirements
- **GST**: Goods and Services Tax compliance with ATO standards

## 1. AML/CTF Compliance

### Transaction Monitoring
- Real-time monitoring of all financial transactions
- Risk scoring based on multiple factors:
  - Transaction amounts (TTR threshold: $10,000 AUD)
  - Velocity patterns (rapid successive transactions)
  - Structuring detection (smurfing)
  - Suspicious patterns (round amounts, high-risk categories)
- Automated flagging of high-risk transactions
- AUSTRAC reporting integration

### API Endpoints
- `POST /api/compliance/aml/monitor-transaction`: Monitor individual transactions
- `GET /api/compliance/aml/alerts`: View pending alerts (admin only)
- `POST /api/compliance/aml/alerts`: Review and action alerts

### Risk Factors
- Transactions over $10,000 AUD (Threshold Transaction Reports)
- High velocity: >20 transactions in 24 hours or >3 in 5 minutes
- Structuring patterns: Multiple transactions just below reporting threshold
- High-risk merchant categories: Gambling, cryptocurrency, money transfer
- Dormant accounts suddenly active

## 2. Privacy Act Compliance

### Consent Management
- Granular consent tracking for different purposes
- Consent versioning and expiry management
- Easy consent withdrawal mechanism
- Legal basis tracking (consent, contract, legitimate interest)

### Data Subject Rights
- **Access requests**: Export all personal data
- **Portability requests**: Machine-readable data export
- **Deletion requests**: Right to be forgotten (with legal exceptions)
- **Correction requests**: Update incorrect data
- **30-day processing requirement** as per Privacy Act

### API Endpoints
- `GET /api/compliance/privacy/consent`: View consent history
- `POST /api/compliance/privacy/consent`: Record new consent
- `DELETE /api/compliance/privacy/consent`: Withdraw consent
- `POST /api/compliance/privacy/data-request`: Submit data request

## 3. APRA Compliance

### Data Residency
- Automatic verification of data storage in Australian regions
- Monitoring of database, file storage, and backup locations
- Alerts for non-compliant data storage

### Incident Management
- Structured incident reporting system
- 72-hour APRA reporting requirement tracking
- Automatic OAIC notification for data breaches
- Severity levels: Critical, High, Medium, Low
- Business continuity plan activation

### System Monitoring
- Health checks for critical services
- Backup verification (24-hour requirement)
- Recovery Time Objective: 4 hours
- Comprehensive audit trails

### API Endpoints
- `POST /api/compliance/apra/incidents`: Create incident report
- `POST /api/compliance/apra/incidents` (with status): Update incident
- `GET /api/compliance/apra/data-residency`: Check compliance status

## 4. GST Compliance

### GST Calculation
- Automatic GST calculation (10% rate)
- Treatment classification:
  - Taxable supply
  - GST-free (exports, basic food, health, education)
  - Input taxed (financial supplies, residential rent)
  - Out of scope
- Input tax credit tracking

### ABN Validation
- ATO-compliant ABN validation algorithm
- GST registration status checking
- Proper ABN formatting (XX XXX XXX XXX)

### BAS Reporting
- Automated Business Activity Statement generation
- Monthly and quarterly reporting periods
- Export sales tracking
- Capital purchases identification
- Net GST calculation

### API Endpoints
- `POST /api/compliance/gst/calculate`: Calculate GST for transactions
- `POST /api/compliance/gst/validate-abn`: Validate and format ABN
- `POST /api/compliance/gst/bas-report`: Generate BAS report

## 5. Automated Monitoring Scripts

### ⚠️ SECURITY WARNING

**NEVER run these TypeScript scripts directly in production environments using ts-node!**

Running TypeScript files with `ts-node` in production poses significant security risks:
- Potential code injection vulnerabilities
- Unvalidated script execution
- Performance overhead from runtime compilation
- Exposure of source code and sensitive logic

#### Recommended Security Practices:

1. **Development/Testing Only**: Use `ts-node` commands only in controlled development or testing environments
2. **Production Execution**: 
   - Compile TypeScript to JavaScript: `npm run build`
   - Run compiled JavaScript files: `node dist/scripts/compliance/script-name.js`
   - Use proper process managers (PM2, systemd) with restricted permissions
3. **Script Validation**:
   - Review all scripts before execution
   - Implement code signing for production scripts
   - Use environment-specific configuration files
   - Run scripts with minimal required permissions
4. **Security Checklist Before Execution**:
   - [ ] Verify script source and integrity
   - [ ] Review for hardcoded credentials or sensitive data
   - [ ] Ensure proper environment variable usage
   - [ ] Confirm script runs with least privilege
   - [ ] Check for external dependencies and vulnerabilities

### Daily Monitoring
Run all compliance checks daily:

**Development/Testing:**
```bash
# Only in secure, non-production environments
ts-node scripts/compliance/run-all-monitoring.ts
```

**Production (Recommended):**
```bash
# First compile TypeScript
npm run build

# Then run compiled JavaScript
node dist/scripts/compliance/run-all-monitoring.js
```

Individual monitoring scripts:
- `scripts/compliance/aml-monitoring.ts`: AML transaction monitoring
- `scripts/compliance/privacy-monitoring.ts`: Privacy compliance checks
- `scripts/compliance/apra-monitoring.ts`: APRA compliance verification

### Monthly Reporting
Automatic generation on the 1st of each month:

**Development/Testing:**
```bash
# Only in secure, non-production environments
ts-node scripts/compliance/generate-monthly-report.ts
```

**Production (Recommended):**
```bash
# Use compiled version
node dist/scripts/compliance/generate-monthly-report.js
```

Reports include:
- Executive summary with compliance status
- AML/CTF statistics and alerts
- Privacy consent and request metrics
- APRA incident and system health data
- GST collection and validation summary

## 6. Compliance Dashboard

Access the compliance dashboard at `/admin/compliance` (admin only).

Features:
- Real-time compliance status overview
- Pending alerts and actions
- Recent incidents and reports
- Compliance metrics and trends

## 7. Database Schema

New compliance tables:
- `aml_transaction_monitoring`: AML risk assessments
- `privacy_consents`: User consent records
- `data_access_requests`: Privacy Act requests
- `apra_incident_reports`: Incident tracking
- `gst_transaction_details`: GST calculations
- `compliance_configuration`: System configuration

## 8. Security Considerations

- All sensitive data is encrypted at rest
- Audit logs maintain data integrity with hash chains
- Role-based access control (ADMIN, SUPPORT roles)
- IP tracking for compliance actions
- Secure data export with time-limited URLs

## 9. Integration Points

### AUSTRAC
- Suspicious Matter Reports (SMR) submission
- Threshold Transaction Reports (TTR)

### ATO
- ABN Lookup API integration
- BAS lodgment preparation
- GST validation

### APRA
- Incident reporting
- Data residency verification

### OAIC
- Data breach notifications
- Privacy compliance reporting

## 10. Best Practices

1. **Regular Monitoring**: Run compliance scripts daily
2. **Prompt Action**: Review and action alerts within 24 hours
3. **Documentation**: Maintain detailed notes on all compliance decisions
4. **Training**: Ensure staff understand compliance requirements
5. **Updates**: Keep compliance thresholds and rules current

## Support

For compliance-related queries:
- Technical issues: dev@taxreturnpro.com.au
- Compliance questions: compliance@taxreturnpro.com.au
- Urgent incidents: Use in-app incident reporting