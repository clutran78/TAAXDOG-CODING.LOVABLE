-- CreateEnum
CREATE TYPE "AMLMonitoringType" AS ENUM ('THRESHOLD_EXCEEDED', 'VELOCITY_CHECK', 'PATTERN_DETECTION', 'SUSPICIOUS_ACTIVITY', 'CUSTOMER_RISK_PROFILE', 'SANCTIONS_SCREENING');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_SERVICE', 'MARKETING_COMMUNICATIONS', 'DATA_SHARING', 'THIRD_PARTY_INTEGRATION', 'BIOMETRIC_DATA');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS_REQUEST', 'PORTABILITY_REQUEST', 'DELETION_REQUEST', 'CORRECTION_REQUEST', 'RESTRICTION_REQUEST');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING', 'VERIFIED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('DATA_BREACH', 'SYSTEM_OUTAGE', 'SECURITY_INCIDENT', 'COMPLIANCE_BREACH', 'OPERATIONAL_FAILURE', 'THIRD_PARTY_FAILURE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GSTTreatment" AS ENUM ('TAXABLE_SUPPLY', 'GST_FREE', 'INPUT_TAXED', 'OUT_OF_SCOPE');

-- AlterEnum
ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_CONSENT_GRANTED';
ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_CONSENT_REVOKED';
ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_DATA_ACCESS';
ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_DATA_DELETION';
ALTER TYPE "FinancialOperation" ADD VALUE 'COMPLIANCE_REPORT_GENERATED';
ALTER TYPE "FinancialOperation" ADD VALUE 'AML_TRANSACTION_FLAGGED';
ALTER TYPE "FinancialOperation" ADD VALUE 'AML_REPORT_SUBMITTED';

-- CreateTable
CREATE TABLE "aml_transaction_monitoring" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_transaction_monitoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_consents" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_access_requests" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apra_incident_reports" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apra_incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_transaction_details" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_transaction_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_configuration" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aml_transaction_monitoring_userId_idx" ON "aml_transaction_monitoring"("userId");

-- CreateIndex
CREATE INDEX "aml_transaction_monitoring_transactionId_idx" ON "aml_transaction_monitoring"("transactionId");

-- CreateIndex
CREATE INDEX "aml_transaction_monitoring_requiresReview_idx" ON "aml_transaction_monitoring"("requiresReview");

-- CreateIndex
CREATE INDEX "aml_transaction_monitoring_riskScore_idx" ON "aml_transaction_monitoring"("riskScore");

-- CreateIndex
CREATE INDEX "aml_transaction_monitoring_createdAt_idx" ON "aml_transaction_monitoring"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_consents_userId_consentType_consentVersion_key" ON "privacy_consents"("userId", "consentType", "consentVersion");

-- CreateIndex
CREATE INDEX "privacy_consents_userId_idx" ON "privacy_consents"("userId");

-- CreateIndex
CREATE INDEX "privacy_consents_consentType_idx" ON "privacy_consents"("consentType");

-- CreateIndex
CREATE INDEX "privacy_consents_consentStatus_idx" ON "privacy_consents"("consentStatus");

-- CreateIndex
CREATE INDEX "privacy_consents_expiryDate_idx" ON "privacy_consents"("expiryDate");

-- CreateIndex
CREATE INDEX "data_access_requests_userId_idx" ON "data_access_requests"("userId");

-- CreateIndex
CREATE INDEX "data_access_requests_requestType_idx" ON "data_access_requests"("requestType");

-- CreateIndex
CREATE INDEX "data_access_requests_requestStatus_idx" ON "data_access_requests"("requestStatus");

-- CreateIndex
CREATE INDEX "data_access_requests_dueDate_idx" ON "data_access_requests"("dueDate");

-- CreateIndex
CREATE INDEX "apra_incident_reports_incidentType_idx" ON "apra_incident_reports"("incidentType");

-- CreateIndex
CREATE INDEX "apra_incident_reports_severity_idx" ON "apra_incident_reports"("severity");

-- CreateIndex
CREATE INDEX "apra_incident_reports_status_idx" ON "apra_incident_reports"("status");

-- CreateIndex
CREATE INDEX "apra_incident_reports_detectedAt_idx" ON "apra_incident_reports"("detectedAt");

-- CreateIndex
CREATE INDEX "gst_transaction_details_transactionId_idx" ON "gst_transaction_details"("transactionId");

-- CreateIndex
CREATE INDEX "gst_transaction_details_invoiceId_idx" ON "gst_transaction_details"("invoiceId");

-- CreateIndex
CREATE INDEX "gst_transaction_details_taxPeriod_idx" ON "gst_transaction_details"("taxPeriod");

-- CreateIndex
CREATE INDEX "gst_transaction_details_taxCategory_idx" ON "gst_transaction_details"("taxCategory");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_configuration_configType_key" ON "compliance_configuration"("configType");

-- AddForeignKey
ALTER TABLE "aml_transaction_monitoring" ADD CONSTRAINT "aml_transaction_monitoring_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_consents" ADD CONSTRAINT "privacy_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_requests" ADD CONSTRAINT "data_access_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;