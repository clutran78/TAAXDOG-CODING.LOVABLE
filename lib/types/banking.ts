/**
 * Banking integration type definitions
 */

import { AccountType, MoneyAmount } from './financial';
import { AuditInfo } from './common';

// Bank connection status
export enum ConnectionStatus {
  PENDING = 'PENDING',
  CONNECTED = 'CONNECTED',
  REFRESHING = 'REFRESHING',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED',
  EXPIRED = 'EXPIRED',
}

// Institution types
export enum InstitutionType {
  BANK = 'BANK',
  CREDIT_UNION = 'CREDIT_UNION',
  BUILDING_SOCIETY = 'BUILDING_SOCIETY',
  DIGITAL_BANK = 'DIGITAL_BANK',
  CREDIT_CARD_PROVIDER = 'CREDIT_CARD_PROVIDER',
}

// Sync status
export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

// Financial institution
export interface FinancialInstitution {
  id: string;
  name: string;
  shortName: string;
  type: InstitutionType;
  logoUrl?: string | null;
  primaryColor?: string | null;
  country: 'AU';
  supportedFeatures: string[];
  isActive: boolean;
  basiqInstitutionId?: string | null;
}

// Bank connection
export interface BankConnection extends AuditInfo {
  id: string;
  userId: string;
  institutionId: string;
  institution?: FinancialInstitution;

  // Connection details
  status: ConnectionStatus;
  connectionMethod: 'OAUTH' | 'CREDENTIALS' | 'OPEN_BANKING';
  basiqConnectionId?: string | null;

  // Consent
  consentId?: string | null;
  consentExpiresAt?: Date | null;
  consentScopes?: string[] | null;

  // Sync info
  lastSyncedAt?: Date | null;
  syncStatus: SyncStatus;
  syncError?: string | null;
  nextSyncAt?: Date | null;

  // Settings
  autoSync: boolean;
  syncFrequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MANUAL';

  // Soft delete
  deletedAt?: Date | null;
}

// Bank account
export interface BankAccount extends AuditInfo {
  id: string;
  userId: string;
  connectionId: string;
  connection?: BankConnection;
  basiqAccountId?: string | null;

  // Account details
  accountName: string;
  accountNumber?: string | null; // Masked
  bsb?: string | null;
  accountType: AccountType;

  // Balance info
  currentBalance: number;
  availableBalance: number;
  currency: 'AUD';
  lastBalanceUpdate?: Date | null;

  // Credit specific
  creditLimit?: number | null;
  minimumPayment?: number | null;
  paymentDueDate?: Date | null;

  // Loan specific
  loanAmount?: number | null;
  interestRate?: number | null;
  repaymentAmount?: number | null;
  repaymentFrequency?: string | null;

  // Settings
  nickname?: string | null;
  isActive: boolean;
  includeInNetWorth: boolean;
  includeInCashFlow: boolean;
  isPrimary: boolean;

  // Soft delete
  deletedAt?: Date | null;
}

// Account balance history
export interface AccountBalance {
  id: string;
  accountId: string;
  date: Date;
  balance: number;
  availableBalance?: number | null;
  currency: 'AUD';
}

// Connection consent
export interface BankingConsent {
  id: string;
  userId: string;
  connectionId: string;

  // Consent details
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  grantedAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;

  // Permissions
  permissions: string[];
  institutionId: string;

  // Audit
  ipAddress: string;
  userAgent: string;
}

// Sync job
export interface SyncJob {
  id: string;
  connectionId: string;

  // Job details
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  type: 'FULL' | 'INCREMENTAL' | 'BALANCE_ONLY';

  // Progress
  startedAt?: Date | null;
  completedAt?: Date | null;

  // Results
  accountsSynced: number;
  transactionsSynced: number;
  newTransactions: number;
  updatedTransactions: number;
  errors?: string[] | null;

  // Metadata
  triggeredBy: 'USER' | 'SCHEDULED' | 'WEBHOOK' | 'SYSTEM';
  metadata?: Record<string, unknown>;
}

// Banking webhook events
export interface BankingWebhookEvent {
  id: string;
  type: 'CONNECTION_UPDATE' | 'TRANSACTION_UPDATE' | 'BALANCE_UPDATE' | 'ERROR';
  connectionId: string;
  payload: unknown;
  processedAt?: Date | null;
  createdAt: Date;
}

// Connection request DTOs
export interface CreateConnectionInput {
  institutionId: string;
  credentials?: {
    username: string;
    password: string;
  };
  consentDuration?: number; // days
}

export interface RefreshConnectionInput {
  connectionId: string;
  fullRefresh?: boolean;
}

// Account aggregation
export interface AccountsSummary {
  totalAccounts: number;
  activeAccounts: number;
  totalAssets: MoneyAmount;
  totalLiabilities: MoneyAmount;
  netWorth: MoneyAmount;

  byType: Array<{
    type: AccountType;
    count: number;
    totalBalance: MoneyAmount;
  }>;

  byInstitution: Array<{
    institution: string;
    count: number;
    totalBalance: MoneyAmount;
    lastSync: Date;
  }>;
}

// Open Banking specific
export interface OpenBankingMetadata {
  dataHolderId: string;
  dataHolderBrandName: string;
  consentId: string;
  sharingDuration: number; // seconds
  permissions: string[];
}
