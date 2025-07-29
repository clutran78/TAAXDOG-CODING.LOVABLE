#!/bin/sh
# PostgreSQL initialization script
# This runs when the PostgreSQL container is first created

set -e

# Create additional databases if needed
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Create test database for running tests
    CREATE DATABASE ${POSTGRES_DB}_test;
    GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB}_test TO $POSTGRES_USER;

    -- Set timezone to Australia/Sydney
    ALTER DATABASE $POSTGRES_DB SET timezone TO 'Australia/Sydney';
    ALTER DATABASE ${POSTGRES_DB}_test SET timezone TO 'Australia/Sydney';

    -- Create extensions
    \c $POSTGRES_DB
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    \c ${POSTGRES_DB}_test
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- Set default text search configuration to English
    \c $POSTGRES_DB
    ALTER DATABASE $POSTGRES_DB SET default_text_search_config TO 'pg_catalog.english';
    
    -- Performance settings for development
    ALTER SYSTEM SET log_statement = 'all';
    ALTER SYSTEM SET log_duration = on;
    ALTER SYSTEM SET log_min_duration_statement = 100;
    
    -- Create application user if different from superuser
    -- CREATE USER app_user WITH ENCRYPTED PASSWORD 'app_password';
    -- GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO app_user;
    -- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
    -- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
EOSQL

echo "PostgreSQL initialization complete"