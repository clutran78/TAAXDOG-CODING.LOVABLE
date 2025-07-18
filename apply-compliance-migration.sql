-- TAAXDOG Compliance Migration
-- Run this script to add compliance tables to your database
-- 
-- Usage: psql -U <username> -h <host> -d <database> -f apply-compliance-migration.sql

\echo 'Starting TAAXDOG Compliance Migration...'
\echo '======================================='

-- Run the migration
\i prisma/migrations/20250118_add_compliance_features/migration.sql

-- Verify tables were created
\echo ''
\echo 'Verifying compliance tables...'
\echo '-----------------------------'

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'aml_transaction_monitoring',
    'privacy_consents',
    'data_access_requests',
    'apra_incident_reports',
    'gst_transaction_details',
    'compliance_configuration'
)
ORDER BY table_name;

\echo ''
\echo 'Migration complete!'
\echo ''
\echo 'Next steps:'
\echo '1. Verify all 6 compliance tables were created'
\echo '2. Update Prisma schema tracking: npx prisma migrate resolve --applied 20250118_add_compliance_features'
\echo '3. Test the compliance API endpoints'