# Firebase to PostgreSQL Data Transformation System

## Overview

This comprehensive system transforms Firebase Firestore data to PostgreSQL
format for the Taaxdog-coding project, with full Australian compliance
validation and data integrity checks.

## System Components

### 1. **Data Transformer** (`firebase-to-postgresql-transformer.js`)

- Converts Firebase document IDs to PostgreSQL UUIDs
- Transforms timestamps to ISO format
- Validates Australian-specific data formats
- Maintains all foreign key relationships
- Handles nested objects as JSONB fields

### 2. **Australian Validators**

- **BSB Validation**: 6-digit format with range checking
- **Phone Numbers**: Australian mobile/landline formats
- **ABN Validation**: 11-digit with checksum verification
- **TFN Validation**: 8-9 digit with checksum
- **GST Calculation**: 10% Australian GST rate
- **Currency**: AUD with 2 decimal precision

### 3. **PostgreSQL Importer** (`postgresql-import.js`)

- Batch import with retry logic
- Foreign key relationship preservation
- Sequence management
- Transaction safety
- Detailed import reporting

### 4. **Pipeline Orchestrator** (`firebase-postgresql-pipeline.js`)

- Automated end-to-end migration
- Interactive or batch mode
- Progress tracking
- Comprehensive error handling

## Quick Start

### Prerequisites

```bash
# Install required dependencies
npm install firebase-admin pg uuid date-fns

# Ensure Firebase config exists
# config/firebase-adminsdk.json

# Set database URL (optional)
export DATABASE_URL="postgresql://user:pass@host:port/database?sslmode=require"
```

### Run Complete Migration

```bash
# Interactive mode (recommended)
npm run firebase:migrate

# Batch mode
npm run firebase:pipeline -- --no-interactive
```

### Individual Steps

```bash
# 1. Export from Firebase
npm run firebase:export

# 2. Validate data
npm run firebase:validate

# 3. Transform for PostgreSQL
npm run firebase:transform firebase-exports firebase-transformed

# 4. Import to PostgreSQL
npm run firebase:import firebase-transformed
```

## Data Transformations

### User Collection

| Firebase Field | PostgreSQL Field      | Transformation                |
| -------------- | --------------------- | ----------------------------- |
| Document ID    | id (UUID)             | Deterministic UUID generation |
| email          | email                 | Lowercase, validated format   |
| phone          | phone                 | +61 international format      |
| abn            | abn                   | 11-digit validated ABN        |
| tfn            | tfn                   | 8-9 digit validated TFN       |
| timestamps     | created_at/updated_at | ISO 8601 format               |

### Financial Data

| Field Type     | Validation        | Format                       |
| -------------- | ----------------- | ---------------------------- |
| Amounts        | Decimal precision | DECIMAL(15,2)                |
| GST            | 10% calculation   | Auto-calculated for expenses |
| Tax Categories | ATO compliance    | Mapped to valid categories   |
| BSB            | Australian banks  | XXX-XXX format               |

### Relationships

- All foreign keys preserved through ID mapping
- Deterministic UUID generation ensures consistency
- Relationship validation during transformation
- Referential integrity maintained

## Australian Compliance Features

### Tax Compliance

- ATO-compliant tax categories
- GST calculation and validation
- Business expense classification
- Tax year handling (July-June)

### Data Formats

- Australian phone number formats
- BSB validation against known ranges
- ABN checksum verification
- TFN format validation
- Australian institution verification

### Financial Validation

- Currency amounts in AUD
- GST at 10% rate
- Decimal precision for financial data
- Australian bank validation

## Output Structure

```
firebase-transformed/
├── users_transformed.json         # Transformed user data
├── bankAccounts_transformed.json  # Bank account data
├── transactions_transformed.json  # Transaction data
├── receipts_transformed.json      # Receipt data
├── budgets_transformed.json       # Budget data
├── budgetTracking_transformed.json # Budget tracking
├── financialInsights_transformed.json # Insights
├── transformation_report.json     # Detailed report
├── integrity_report.json         # Data integrity check
├── import_report.json           # Import results
├── IMPORT_REPORT.md             # Human-readable import summary
└── PIPELINE_SUMMARY.md          # Complete pipeline summary
```

## Error Handling

### Validation Errors

- Field-level validation with detailed messages
- Warning vs error severity levels
- Australian compliance checks
- Data type validations

### Transformation Errors

- Document-level error tracking
- Partial success handling
- Detailed error reporting
- Recovery procedures

### Import Errors

- Batch failure recovery
- Individual record retry
- Transaction rollback
- Error logging

## Monitoring Progress

The system provides real-time progress updates:

- Export progress by collection
- Validation summary
- Transformation statistics
- Import progress with success rates

## Data Integrity

### Pre-Import Checks

- Email uniqueness validation
- Foreign key relationship verification
- Required field validation
- Data type constraint checks

### Post-Import Verification

- Record count validation
- Relationship integrity checks
- Sequence synchronization
- Data consistency verification

## Troubleshooting

### Common Issues

1. **Missing References**
   - Check ID mappings in `transformation_report.json`
   - Verify source data completeness
   - Review relationship validation errors

2. **Validation Failures**
   - Check Australian format requirements
   - Review field-specific validation rules
   - Examine validation report for details

3. **Import Failures**
   - Verify database connection
   - Check PostgreSQL schema matches
   - Review import error logs

### Debug Mode

```bash
# Run with detailed logging
NODE_ENV=debug npm run firebase:pipeline
```

## Security Considerations

- Sensitive data preserved during transformation
- No data exposed in logs
- Secure database connections
- Audit trail maintained

## Performance

- Batch processing for large datasets
- Configurable batch sizes
- Memory-efficient streaming
- Parallel processing where applicable

## Support

For issues or questions:

1. Check transformation reports
2. Review validation summaries
3. Examine error logs
4. Verify prerequisites are met
