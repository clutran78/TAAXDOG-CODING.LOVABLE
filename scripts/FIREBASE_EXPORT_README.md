# Firebase Export System Documentation

## Overview

This system provides a comprehensive solution for exporting data from Firebase
Firestore to PostgreSQL, specifically designed for the Taaxdog-coding project.
It handles data validation, transformation, and migration preparation with
Australian-specific requirements.

## Components

### 1. Firebase Export Script (`firebase-export.js`)

Exports all collections from Firebase with:

- Batch processing for large collections
- Retry logic for network issues
- ID mapping generation
- Timestamp conversion
- Progress tracking and reporting

### 2. Data Validator (`firebase-data-validator.js`)

Validates exported data for:

- Required fields
- Data types and formats
- Australian-specific validations (ABN, phone numbers, BSB)
- Foreign key relationships
- Unique constraints

### 3. Migration Preparation (`prepare-firebase-migration.js`)

Prepares data for PostgreSQL import:

- Generates deterministic UUIDs from Firebase IDs
- Transforms field names to match PostgreSQL schema
- Creates CSV files for bulk import
- Generates SQL import scripts

## Usage

### Quick Start

```bash
# Run complete migration pipeline
npm run firebase:migrate
```

### Individual Steps

```bash
# 1. Export data from Firebase
npm run firebase:export

# 2. Validate exported data
npm run firebase:validate

# 3. Prepare for PostgreSQL import
npm run firebase:prepare
```

## Export Directory Structure

```
firebase-exports/
├── users.json              # Exported user data
├── bankAccounts.json       # Bank account data
├── transactions.json       # Transaction data
├── receipts.json          # Receipt data
├── budgets.json           # Budget data
├── budgetTracking.json    # Budget tracking data
├── financialInsights.json # Financial insights
├── export_summary.json    # Export statistics
├── README.md              # Human-readable summary
├── validation_report.json # Validation results
├── VALIDATION_REPORT.md   # Validation summary
├── mappings/              # Firebase ID mappings
│   ├── users_mapping.json
│   ├── bankAccounts_mapping.json
│   └── ...
├── postgresql-ready/      # Transformed data
│   ├── users.json
│   ├── users.csv
│   ├── id_mappings.json
│   └── sql/
│       ├── import_all.sql
│       └── rollback.sql
└── logs/                  # Error logs

```

## Data Transformations

### Australian-Specific Validations

1. **Phone Numbers**: Converted to international format (+61)
2. **ABN**: Validated as 11-digit number
3. **BSB**: Formatted as XXX-XXX
4. **GST**: Calculated at 10% for business expenses

### Field Mappings

| Firebase Field | PostgreSQL Field | Transformation  |
| -------------- | ---------------- | --------------- |
| userId         | user_id          | UUID conversion |
| totalAmount    | total_amount     | Decimal         |
| aiProcessed    | ai_processed     | Boolean         |
| createdAt      | created_at       | ISO timestamp   |

## PostgreSQL Import

After running the export pipeline:

```bash
# 1. Ensure PostgreSQL database exists and schema is created
psql -U postgres -d taaxdog_production

# 2. Import all data
psql -U postgres -d taaxdog_production -f firebase-exports/postgresql-ready/sql/import_all.sql

# 3. If needed, rollback
psql -U postgres -d taaxdog_production -f firebase-exports/postgresql-ready/sql/rollback.sql
```

## Error Handling

The system includes:

- Automatic retry for network failures
- Detailed error logging
- Data integrity checks
- Transaction rollback capabilities

## Security Considerations

1. **Credentials**: Firebase service account is loaded from
   `config/firebase-adminsdk.json`
2. **Data Privacy**: Sensitive fields are preserved during export
3. **Audit Trail**: All exports include timestamps and metadata

## Troubleshooting

### Common Issues

1. **Authentication Error**
   - Verify `config/firebase-adminsdk.json` exists and is valid
   - Check Firebase project ID matches

2. **Memory Issues**
   - Reduce `batchSize` in export configuration
   - Export collections individually

3. **Validation Failures**
   - Review `VALIDATION_REPORT.md` for specific issues
   - Fix data in Firebase before re-exporting

### Support

For issues or questions:

- Check error logs in `firebase-exports/logs/`
- Review validation reports
- Ensure all dependencies are installed: `npm install`
