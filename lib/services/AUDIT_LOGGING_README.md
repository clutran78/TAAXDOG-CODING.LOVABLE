# Financial Audit Logging System

This comprehensive audit logging system ensures Australian financial compliance
for the TAAXDOG application.

## Features

### 1. Complete Financial Operation Tracking

- **Goal Operations**: Create, update, delete, complete
- **Transaction Operations**: Create, update, delete, categorize
- **Receipt Operations**: Upload, process, update, delete, match
- **Banking Operations**: Connect, disconnect, sync, account management
- **Budget Operations**: Create, update, delete
- **Subscription Operations**: Create, update, cancel
- **Tax Operations**: Return creation, updates, submissions

### 2. Audit Fields

Every audit log entry includes:

- User ID and session ID
- IP address and user agent
- Timestamp with Australian timezone
- Operation type and result
- Data before/after changes
- Changed fields tracking
- Financial amounts and GST
- Tax year calculation
- Hash chain for integrity

### 3. Data Integrity

- SHA-256 hash chain linking all audit entries
- Previous hash verification
- Integrity checking endpoints
- Tamper detection

### 4. Compliance Features

- 7-year retention policy (Australian requirement)
- Automatic tax year calculation
- GST amount tracking
- Australian timezone handling
- Comprehensive reporting

## Usage

### Basic Audit Logging

```typescript
import { createAuditLog, FinancialOperation } from '@/lib/services/auditLogger';

// Log a financial operation
await createAuditLog(
  {
    userId: session.user.id,
    operationType: FinancialOperation.GOAL_CREATE,
    resourceType: 'Goal',
    resourceId: goal.id,
    currentData: goal,
    amount: goal.targetAmount,
    success: true,
  },
  {
    request: req,
    sessionId: session.user.id,
  },
);
```

### With Data Change Tracking

```typescript
// Log with before/after data
await createAuditLog(
  {
    userId: session.user.id,
    operationType: FinancialOperation.GOAL_UPDATE,
    resourceType: 'Goal',
    resourceId: goal.id,
    previousData: existingGoal,
    currentData: updatedGoal,
    amount: updatedGoal.targetAmount,
    success: true,
  },
  {
    request: req,
  },
);
```

### Using Middleware

```typescript
import { withAuditLogging } from '@/lib/services/auditLogger';

// Wrap your API handler
export default withAuditLogging(
  FinancialOperation.RECEIPT_UPLOAD,
  'Receipt',
)(async (req, res) => {
  // Your handler code
});
```

## API Endpoints

### Generate Audit Report

```
POST /api/admin/audit-reports/generate
{
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "operationType": "GOAL_CREATE",
  "includeDetails": true,
  "format": "json" // or "csv"
}
```

### Monthly Compliance Report

```
GET /api/admin/audit-reports/monthly-compliance?year=2024&month=1
```

### Verify Integrity

```
POST /api/admin/audit-logs/verify-integrity
{
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z"
}
```

### Cleanup Old Logs

```
POST /api/admin/audit-logs/cleanup
```

## Maintenance

### Automated Tasks

Run daily via cron:

```bash
# Full maintenance (cleanup + verify + report)
npm run audit:maintenance

# Individual tasks
npm run audit:cleanup
npm run audit:verify
```

### Cron Setup

```bash
# Daily at 2 AM Sydney time
0 2 * * * cd /path/to/project && npm run audit:maintenance
```

## Database Schema

```prisma
model FinancialAuditLog {
  id                String              @id @default(uuid())
  userId            String
  sessionId         String?             @db.Uuid
  operationType     FinancialOperation
  resourceType      String              @db.VarChar(100)
  resourceId        String?             @db.Uuid
  ipAddress         String              @db.VarChar(45)
  userAgent         String?             @db.Text
  httpMethod        String?             @db.VarChar(10)
  endpoint          String?             @db.VarChar(500)

  // Data changes tracking
  previousData      Json?               @map("previous_data")
  currentData       Json?               @map("current_data")
  changedFields     String[]            @map("changed_fields")

  // Financial compliance fields
  amount            Decimal?            @db.Decimal(15, 2)
  gstAmount         Decimal?            @db.Decimal(15, 2)
  currency          String?             @default("AUD")
  taxYear           String?             @db.VarChar(10)

  // Security and integrity
  success           Boolean             @default(true)
  errorMessage      String?             @map("error_message")
  hashChain         String?             @db.VarChar(64)
  previousHash      String?             @db.VarChar(64)

  // Timestamps
  createdAt         DateTime            @default(now())
  timezone          String              @default("Australia/Sydney")
}
```

## Security Considerations

1. **Access Control**: Only admins and accountants can access audit reports
2. **Data Privacy**: Sensitive data (passwords, tokens) are never logged
3. **Integrity**: Hash chain prevents tampering
4. **Retention**: 7-year retention meets Australian requirements
5. **Timezone**: All timestamps use Australian timezone

## Compliance Notes

- Meets Australian financial record-keeping requirements
- GST tracking for all financial operations
- Tax year calculation (July 1 - June 30)
- Comprehensive reporting for auditors
- Data integrity verification

## Report Examples

### Summary Report

```json
{
  "summary": {
    "totalOperations": 1250,
    "successfulOperations": 1200,
    "failedOperations": 50,
    "operationsByType": {
      "GOAL_CREATE": 150,
      "TRANSACTION_CREATE": 500,
      "RECEIPT_UPLOAD": 300
    },
    "uniqueUsers": 75,
    "totalAmount": 125000.5,
    "totalGstAmount": 11363.68
  }
}
```

### CSV Export

The system can export audit logs in CSV format for external analysis and
compliance reporting.
