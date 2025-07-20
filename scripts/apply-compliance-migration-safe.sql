-- TAAXDOG Compliance Migration (Safe Version)
-- This version checks for existing enums and tables before creating them

\echo 'Starting TAAXDOG Compliance Migration (Safe Version)...'
\echo '====================================================='

-- Create FinancialOperation enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinancialOperation') THEN
        CREATE TYPE "FinancialOperation" AS ENUM (
            'GOAL_CREATE',
            'GOAL_UPDATE', 
            'GOAL_DELETE',
            'GOAL_COMPLETE',
            'TRANSACTION_CREATE',
            'TRANSACTION_UPDATE',
            'TRANSACTION_DELETE',
            'TRANSACTION_CATEGORIZE',
            'RECEIPT_UPLOAD',
            'RECEIPT_PROCESS',
            'RECEIPT_UPDATE',
            'RECEIPT_DELETE',
            'RECEIPT_MATCH',
            'BANK_CONNECT',
            'BANK_DISCONNECT',
            'BANK_SYNC',
            'BANK_ACCOUNT_ADD',
            'BANK_ACCOUNT_REMOVE',
            'BUDGET_CREATE',
            'BUDGET_UPDATE',
            'BUDGET_DELETE',
            'SUBSCRIPTION_CREATE',
            'SUBSCRIPTION_UPDATE',
            'SUBSCRIPTION_CANCEL',
            'REPORT_GENERATE',
            'REPORT_EXPORT',
            'TAX_RETURN_CREATE',
            'TAX_RETURN_UPDATE',
            'TAX_RETURN_SUBMIT',
            'DATA_EXPORT',
            'DATA_IMPORT'
        );
    END IF;
END$$;

-- Add new values to FinancialOperation enum
DO $$
BEGIN
    -- Check if value already exists before adding
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'COMPLIANCE_CONSENT_GRANTED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FinancialOperation')
    ) THEN
        ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_CONSENT_GRANTED';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'COMPLIANCE_CONSENT_REVOKED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FinancialOperation')
    ) THEN
        ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_CONSENT_REVOKED';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'COMPLIANCE_DATA_ACCESS' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FinancialOperation')
    ) THEN
        ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_DATA_ACCESS';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'COMPLIANCE_DATA_DELETION' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FinancialOperation')
    ) THEN
        ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_DATA_DELETION';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'COMPLIANCE_REPORT_GENERATED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FinancialOperation')
    ) THEN
        ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_REPORT_GENERATED';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'AML_TRANSACTION_FLAGGED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FinancialOperation')
    ) THEN
        ALTER TYPE "FinancialOperation" ADD VALUE 'AML_TRANSACTION_FLAGGED';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'AML_REPORT_SUBMITTED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'FinancialOperation')
    ) THEN
        ALTER TYPE "FinancialOperation" ADD VALUE 'AML_REPORT_SUBMITTED';
    END IF;
END$$;

-- Create new enums for compliance with existence checks
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AMLMonitoringType') THEN
        CREATE TYPE "AMLMonitoringType" AS ENUM ('THRESHOLD_EXCEEDED', 'VELOCITY_CHECK', 'PATTERN_DETECTION', 'SUSPICIOUS_ACTIVITY', 'CUSTOMER_RISK_PROFILE', 'SANCTIONS_SCREENING');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConsentType') THEN
        CREATE TYPE "ConsentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'MARKETING_COMMUNICATIONS', 'DATA_SHARING', 'THIRD_PARTY_INTEGRATION', 'BIOMETRIC_DATA');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConsentStatus') THEN
        CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'WITHDRAWN', 'EXPIRED');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataRequestType') THEN
        CREATE TYPE "DataRequestType" AS ENUM ('ACCESS_REQUEST', 'PORTABILITY_REQUEST', 'DELETION_REQUEST', 'CORRECTION_REQUEST', 'RESTRICTION_REQUEST');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataRequestStatus') THEN
        CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING', 'VERIFIED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'EXPIRED');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentType') THEN
        CREATE TYPE "IncidentType" AS ENUM ('DATA_BREACH', 'SYSTEM_OUTAGE', 'SECURITY_INCIDENT', 'COMPLIANCE_BREACH', 'OPERATIONAL_FAILURE', 'THIRD_PARTY_FAILURE');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentSeverity') THEN
        CREATE TYPE "IncidentSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentStatus') THEN
        CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GSTTreatment') THEN
        CREATE TYPE "GSTTreatment" AS ENUM ('TAXABLE_SUPPLY', 'GST_FREE', 'INPUT_TAXED', 'OUT_OF_SCOPE');
    END IF;
END$$;

-- Create AML Transaction Monitoring table
CREATE TABLE IF NOT EXISTS "aml_transaction_monitoring" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" UUID,
    "monitoringType" "AMLMonitoringType" NOT NULL,
    "riskScore" DECIMAL(3,2) NOT NULL,
    "riskFactors" TEXT[],
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
    "patternType" VARCHAR(100),
    "patternDetails" JSONB,
    "velocityScore" DECIMAL(3,2),
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reportedToAUSTRAC" BOOLEAN NOT NULL DEFAULT false,
    "reportReference" VARCHAR(255),
    "reportedAt" TIMESTAMP(3),
    "falsePositive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "aml_transaction_monitoring_pkey" PRIMARY KEY ("id")
);

-- Create Privacy Consents table
CREATE TABLE IF NOT EXISTS "privacy_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "consentVersion" VARCHAR(20) NOT NULL,
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consentDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "purposes" TEXT[],
    "dataCategories" TEXT[],
    "thirdParties" TEXT[],
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "legalBasis" VARCHAR(100) NOT NULL,
    "jurisdiction" VARCHAR(10) NOT NULL DEFAULT 'AU',
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "privacy_consents_pkey" PRIMARY KEY ("id")
);

-- Create Data Access Requests table
CREATE TABLE IF NOT EXISTS "data_access_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" "DataRequestType" NOT NULL,
    "requestStatus" "DataRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestDetails" JSONB,
    "verificationMethod" VARCHAR(100),
    "verifiedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "responseMethod" VARCHAR(100),
    "responseUrl" TEXT,
    "responseExpiryDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "extensionReason" TEXT,
    "extendedDueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "data_access_requests_pkey" PRIMARY KEY ("id")
);

-- Create APRA Incident Reports table
CREATE TABLE IF NOT EXISTS "apra_incident_reports" (
    "id" TEXT NOT NULL,
    "incidentType" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "affectedUsers" INTEGER NOT NULL DEFAULT 0,
    "affectedSystems" TEXT[],
    "dataCompromised" BOOLEAN NOT NULL DEFAULT false,
    "financialImpact" DECIMAL(15,2),
    "immediateActions" JSONB,
    "rootCause" TEXT,
    "remediation" JSONB,
    "preventiveMeasures" JSONB,
    "reportedToAPRA" BOOLEAN NOT NULL DEFAULT false,
    "apraReference" VARCHAR(255),
    "reportedToOAIC" BOOLEAN NOT NULL DEFAULT false,
    "oaicReference" VARCHAR(255),
    "bcpActivated" BOOLEAN NOT NULL DEFAULT false,
    "serviceDowntime" INTEGER,
    "dataRecoveryTime" INTEGER,
    "reportedBy" TEXT,
    "responsibleTeam" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "apra_incident_reports_pkey" PRIMARY KEY ("id")
);

-- Create GST Transaction Details table
CREATE TABLE IF NOT EXISTS "gst_transaction_details" (
    "id" TEXT NOT NULL,
    "transactionId" UUID NOT NULL,
    "invoiceId" UUID,
    "baseAmount" DECIMAL(15,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "gstAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "taxCategory" VARCHAR(100) NOT NULL,
    "gstTreatment" "GSTTreatment" NOT NULL,
    "inputTaxCredit" BOOLEAN NOT NULL DEFAULT false,
    "supplierABN" VARCHAR(20),
    "supplierName" VARCHAR(255),
    "isGSTRegistered" BOOLEAN NOT NULL DEFAULT true,
    "basReportingCode" VARCHAR(10),
    "taxPeriod" VARCHAR(10) NOT NULL,
    "reportedInBAS" BOOLEAN NOT NULL DEFAULT false,
    "basReference" VARCHAR(255),
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "validationErrors" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gst_transaction_details_pkey" PRIMARY KEY ("id")
);

-- Create Compliance Configuration table
CREATE TABLE IF NOT EXISTS "compliance_configuration" (
    "id" TEXT NOT NULL,
    "configType" VARCHAR(100) NOT NULL,
    "configData" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "amlThresholds" JSONB,
    "dataRetentionDays" INTEGER,
    "consentExpireDays" INTEGER,
    "incidentReportHours" INTEGER DEFAULT 72,
    "backupFrequency" VARCHAR(50),
    "gstRate" DECIMAL(5,2) DEFAULT 10.00,
    "basReportingCodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "compliance_configuration_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "aml_transaction_monitoring_userId_idx" ON "aml_transaction_monitoring"("userId");
CREATE INDEX IF NOT EXISTS "aml_transaction_monitoring_transactionId_idx" ON "aml_transaction_monitoring"("transactionId");
CREATE INDEX IF NOT EXISTS "aml_transaction_monitoring_requiresReview_idx" ON "aml_transaction_monitoring"("requiresReview");
CREATE INDEX IF NOT EXISTS "aml_transaction_monitoring_riskScore_idx" ON "aml_transaction_monitoring"("riskScore");
CREATE INDEX IF NOT EXISTS "aml_transaction_monitoring_createdAt_idx" ON "aml_transaction_monitoring"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "privacy_consents_userId_consentType_consentVersion_key" ON "privacy_consents"("userId", "consentType", "consentVersion");
CREATE INDEX IF NOT EXISTS "privacy_consents_userId_idx" ON "privacy_consents"("userId");
CREATE INDEX IF NOT EXISTS "privacy_consents_consentType_idx" ON "privacy_consents"("consentType");
CREATE INDEX IF NOT EXISTS "privacy_consents_consentStatus_idx" ON "privacy_consents"("consentStatus");
CREATE INDEX IF NOT EXISTS "privacy_consents_expiryDate_idx" ON "privacy_consents"("expiryDate");

CREATE INDEX IF NOT EXISTS "data_access_requests_userId_idx" ON "data_access_requests"("userId");
CREATE INDEX IF NOT EXISTS "data_access_requests_requestType_idx" ON "data_access_requests"("requestType");
CREATE INDEX IF NOT EXISTS "data_access_requests_requestStatus_idx" ON "data_access_requests"("requestStatus");
CREATE INDEX IF NOT EXISTS "data_access_requests_dueDate_idx" ON "data_access_requests"("dueDate");

CREATE INDEX IF NOT EXISTS "apra_incident_reports_incidentType_idx" ON "apra_incident_reports"("incidentType");
CREATE INDEX IF NOT EXISTS "apra_incident_reports_severity_idx" ON "apra_incident_reports"("severity");
CREATE INDEX IF NOT EXISTS "apra_incident_reports_status_idx" ON "apra_incident_reports"("status");
CREATE INDEX IF NOT EXISTS "apra_incident_reports_detectedAt_idx" ON "apra_incident_reports"("detectedAt");

CREATE INDEX IF NOT EXISTS "gst_transaction_details_transactionId_idx" ON "gst_transaction_details"("transactionId");
CREATE INDEX IF NOT EXISTS "gst_transaction_details_invoiceId_idx" ON "gst_transaction_details"("invoiceId");
CREATE INDEX IF NOT EXISTS "gst_transaction_details_taxPeriod_idx" ON "gst_transaction_details"("taxPeriod");
CREATE INDEX IF NOT EXISTS "gst_transaction_details_taxCategory_idx" ON "gst_transaction_details"("taxCategory");

CREATE UNIQUE INDEX IF NOT EXISTS "compliance_configuration_configType_key" ON "compliance_configuration"("configType");

-- Add foreign key constraints if users table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE "aml_transaction_monitoring" 
        ADD CONSTRAINT "aml_transaction_monitoring_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        
        ALTER TABLE "privacy_consents" 
        ADD CONSTRAINT "privacy_consents_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        
        ALTER TABLE "data_access_requests" 
        ADD CONSTRAINT "data_access_requests_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;

-- Add update trigger for updatedAt columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updatedAt
CREATE TRIGGER update_aml_transaction_monitoring_updated_at BEFORE UPDATE ON "aml_transaction_monitoring"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_privacy_consents_updated_at BEFORE UPDATE ON "privacy_consents"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_access_requests_updated_at BEFORE UPDATE ON "data_access_requests"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apra_incident_reports_updated_at BEFORE UPDATE ON "apra_incident_reports"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gst_transaction_details_updated_at BEFORE UPDATE ON "gst_transaction_details"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_configuration_updated_at BEFORE UPDATE ON "compliance_configuration"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
\echo '2. Run: npx prisma db pull (to sync schema)'
\echo '3. Test the compliance API endpoints'