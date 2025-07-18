# TAAXDOG Compliance Dashboard - Admin Training Guide

## Table of Contents
1. [Overview](#overview)
2. [Access & Permissions](#access--permissions)
3. [AML/CTF Monitoring](#amlctf-monitoring)
4. [Privacy Management](#privacy-management)
5. [APRA Incident Reporting](#apra-incident-reporting)
6. [GST Compliance](#gst-compliance)
7. [Reports & Analytics](#reports--analytics)
8. [Emergency Procedures](#emergency-procedures)
9. [Best Practices](#best-practices)

## Overview

The TAAXDOG Compliance Dashboard provides comprehensive tools for managing Australian financial compliance requirements. This guide covers all administrative functions and procedures.

### Key Compliance Areas
- **AML/CTF**: Anti-Money Laundering and Counter-Terrorism Financing
- **Privacy Act**: Data protection and privacy rights management
- **APRA**: Incident reporting and data residency
- **GST**: Tax compliance and reporting

### Dashboard Access
- URL: `https://taxreturnpro.com.au/admin/compliance`
- Required Role: ADMIN or SUPPORT
- Two-factor authentication required

## Access & Permissions

### Role Capabilities

| Feature | ADMIN | SUPPORT | USER |
|---------|-------|---------|------|
| View AML alerts | ✅ | ✅ | ❌ |
| Review AML alerts | ✅ | ✅ | ❌ |
| Submit AUSTRAC reports | ✅ | ❌ | ❌ |
| Process data requests | ✅ | ✅ | ❌ |
| Create APRA incidents | ✅ | ✅ | ❌ |
| Generate compliance reports | ✅ | ❌ | ❌ |

## AML/CTF Monitoring

### Viewing Alerts

1. Navigate to **Compliance → AML Monitoring**
2. Dashboard shows:
   - Pending alerts count
   - Risk score distribution
   - Recent high-risk transactions

### Reviewing Alerts

**Step 1: Access Alert Details**
```
Click on alert ID → View full transaction details
```

**Step 2: Investigate**
- Check transaction history
- Review user profile
- Analyze risk factors
- Look for patterns

**Step 3: Make Decision**

| Action | When to Use | Result |
|--------|-------------|---------|
| **Clear** | Legitimate transaction | Alert closed, no further action |
| **Report** | Suspicious activity confirmed | SMR submitted to AUSTRAC |
| **False Positive** | System error or misclassification | Alert marked for algorithm improvement |

### AUSTRAC Reporting

**Submitting an SMR (Suspicious Matter Report):**

1. Click "Report to AUSTRAC" on alert
2. Fill in additional details:
   - Suspicion reasons
   - Supporting evidence
   - Related transactions
3. Review and submit
4. Note the reference number

**Important Timelines:**
- SMR: Submit as soon as practicable
- TTR (>$10,000): Within 10 business days

### Common Risk Indicators

⚠️ **High Priority:**
- Transactions just under $10,000 (structuring)
- Rapid successive transactions
- Dormant account suddenly active
- International transfers to high-risk countries

## Privacy Management

### Consent Management

**Viewing User Consents:**
1. Navigate to **Compliance → Privacy → Consents**
2. Search by user email or ID
3. View consent history and status

**Consent Types:**
- Privacy Policy (mandatory)
- Marketing Communications (optional)
- Data Sharing (optional)
- Third-Party Integrations (optional)

### Data Access Requests

**Processing Timeline: 30 days maximum**

**Step-by-Step Process:**

1. **New Request Notification**
   - Email alert received
   - Request appears in dashboard

2. **Verify Identity**
   - Check user details
   - Confirm request authenticity
   - May require additional verification

3. **Process Request**

   **For Access Requests:**
   ```
   1. Click "Process Request"
   2. System generates data export
   3. Review for sensitive information
   4. Approve and send to user
   ```

   **For Deletion Requests:**
   ```
   1. Check for legal retention requirements
   2. If clear, click "Process Deletion"
   3. Confirm irreversible action
   4. System anonymizes/deletes data
   ```

   **For Portability Requests:**
   ```
   1. Click "Generate Portable Export"
   2. System creates JSON/CSV format
   3. Review and approve
   4. Send secure download link
   ```

### Overdue Requests Alert

🚨 **If request is overdue:**
1. Immediate notification sent
2. Escalate to senior admin
3. Document reason for delay
4. Request extension if needed

## APRA Incident Reporting

### Creating an Incident Report

**When to Report:**
- Data breaches
- System outages > 4 hours
- Security incidents
- Compliance breaches

**Severity Levels:**

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **CRITICAL** | Major impact, immediate threat | Immediate | Data breach, complete system failure |
| **HIGH** | Significant impact | Within 2 hours | Partial outage, security vulnerability |
| **MEDIUM** | Moderate impact | Within 24 hours | Performance issues, minor breach |
| **LOW** | Minimal impact | Within 72 hours | Documentation issues |

**Creating Report:**

1. Click **"New Incident"**
2. Fill required fields:
   - Incident type
   - Severity
   - Title and description
   - Affected systems
   - Data compromised? (Yes/No)
   
3. Document immediate actions taken
4. Save as draft or submit

### 72-Hour APRA Reporting Rule

⏰ **Critical Timeline:**
- Detection → APRA Report: Maximum 72 hours
- System shows countdown timer
- Automatic escalation at 48 hours

**Submission Process:**
1. Complete incident investigation
2. Review report details
3. Click "Submit to APRA"
4. Note reference number
5. Monitor for APRA response

### Data Breach Notification

If data is compromised:
1. APRA notification (automatic with incident)
2. OAIC notification required
3. Affected users must be notified
4. Public disclosure may be required

## GST Compliance

### ABN Validation

**Validating an ABN:**
1. Navigate to **Compliance → GST → ABN Validator**
2. Enter ABN (with or without spaces)
3. System checks:
   - Format validity
   - Active status
   - GST registration
   - Entity details

### BAS Report Generation

**Monthly BAS Report:**
1. Go to **Compliance → GST → BAS Reports**
2. Select tax period (e.g., "2024-01")
3. Click "Generate Report"
4. Review totals:
   - Total sales
   - GST collected
   - Input tax credits
   - Net GST payable/refundable

**Quarterly BAS Report:**
- Same process, select quarter (e.g., "2024-Q1")

### GST Calculations

**Checking Transactions:**
1. View transaction details
2. Verify GST treatment:
   - Taxable (10% GST)
   - GST-free (exports, basic food)
   - Input taxed (financial supplies)
   - Out of scope

## Reports & Analytics

### Monthly Compliance Report

**Automatic Generation:**
- Runs 1st of each month
- Covers previous month
- Saved to `/compliance-reports/`

**Manual Generation:**
1. **Compliance → Reports → Generate**
2. Select date range
3. Choose sections to include
4. Click "Generate Report"

### Report Sections

**1. Executive Summary**
- Overall compliance status
- Key metrics
- Action items

**2. AML/CTF Section**
- Transaction monitoring statistics
- Alert summary
- AUSTRAC submissions

**3. Privacy Section**
- Consent metrics
- Data request processing times
- Compliance rate

**4. APRA Section**
- Incidents summary
- System health status
- Data residency confirmation

**5. GST Section**
- Collection summary
- BAS preparation status
- Validation issues

### Exporting Reports

**Formats Available:**
- PDF (formatted report)
- JSON (raw data)
- CSV (spreadsheet)

## Emergency Procedures

### 🚨 Critical Incident Response

**1. Data Breach Detected:**
```
IMMEDIATE ACTIONS:
1. Isolate affected systems
2. Create CRITICAL incident report
3. Notify IT security team
4. Begin 72-hour APRA countdown
5. Prepare OAIC notification
6. Document all actions
```

**2. AML High-Risk Alert:**
```
IMMEDIATE ACTIONS:
1. Review transaction immediately
2. Check for related transactions
3. If suspicious, freeze account
4. Prepare SMR for AUSTRAC
5. Document investigation
```

**3. System Outage:**
```
IMMEDIATE ACTIONS:
1. Activate business continuity plan
2. Create APRA incident (if >4 hours)
3. Switch to manual procedures
4. Communicate with users
5. Monitor recovery progress
```

### Escalation Contacts

**Internal:**
- Compliance Manager: compliance@taxreturnpro.com.au
- IT Security: security@taxreturnpro.com.au
- Legal Team: legal@taxreturnpro.com.au

**External:**
- AUSTRAC Hotline: 1300 021 037
- APRA: 1300 558 849
- OAIC: 1300 363 992

## Best Practices

### Daily Tasks
- ✅ Check AML alerts queue
- ✅ Review pending data requests
- ✅ Monitor system health status
- ✅ Check for overdue items

### Weekly Tasks
- ✅ Review high-risk transactions
- ✅ Process completed data requests
- ✅ Update incident reports
- ✅ Verify backup completion

### Monthly Tasks
- ✅ Review compliance report
- ✅ Audit user permissions
- ✅ Update training materials
- ✅ Test emergency procedures

### Documentation Standards

**For AML Reviews:**
```
Date: [Date]
Reviewer: [Name]
Alert ID: [ID]
Risk Score: [Score]
Decision: [Clear/Report/False Positive]
Rationale: [Detailed explanation]
Evidence: [Supporting information]
```

**For Incident Reports:**
```
Incident ID: [Auto-generated]
Detected: [Timestamp]
Reported by: [Name]
Impact: [Affected users/systems]
Actions taken: [Chronological list]
Resolution: [How resolved]
Lessons learned: [Improvements needed]
```

### Common Mistakes to Avoid

❌ **Don't:**
- Delay SMR submissions
- Process data requests without verification
- Ignore system alerts
- Make decisions without documentation
- Share credentials

✅ **Do:**
- Document everything
- Follow timelines strictly
- Escalate when unsure
- Regular training updates
- Test procedures regularly

## Training Completion

After reading this guide:

1. **Take the compliance quiz** (link in dashboard)
2. **Complete practical exercises:**
   - Process a test AML alert
   - Handle a mock data request
   - Create a test incident report
   
3. **Shadow experienced admin** for 1 week
4. **Receive certification** from Compliance Manager

## Additional Resources

- [AUSTRAC Guidance](https://www.austrac.gov.au/business/how-comply-guidance-and-resources)
- [OAIC Guidelines](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines)
- [APRA Standards](https://www.apra.gov.au/prudential-standards)
- [ATO GST Information](https://www.ato.gov.au/business/gst/)

## Support

**For technical issues:**
- Internal IT: support@taxreturnpro.com.au
- Compliance team: compliance@taxreturnpro.com.au

**For compliance questions:**
- Compliance Manager
- Legal team
- External consultants (if authorized)

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Next Review:** April 2025