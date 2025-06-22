export interface SubaccountTransaction {
  id: string;
  subaccountId: string;
  type: 'deposit' | 'withdrawal' | 'interest' | 'fee' | 'transfer_in' | 'transfer_out';
  amount: number;
  description: string;
  timestamp: string;
  source: 'manual' | 'auto_transfer' | 'interest' | 'bank_sync';
  // Reference to external transaction if from bank sync
  externalTransactionId?: string;
  // For automated transfers, reference to the transfer rule
  transferRuleId?: string;
  // Additional metadata
  metadata?: {
    interestRate?: number;
    fromAccount?: string;
    toAccount?: string;
    feeType?: string;
    [key: string]: any;
  };
}

export interface SubaccountBalance {
  current: number;
  available: number; // May be different if funds are pending/held
  pending: number;
  lastUpdated: string;
  // Interest calculations
  interestEarned?: {
    daily: number;
    monthly: number;
    yearToDate: number;
    totalLifetime: number;
  };
}

export interface BankSubaccountInfo {
  // Real bank subaccount details (when supported)
  bankSubaccountId?: string;
  institutionName: string;
  accountNumber?: string;
  bsb?: string;
  isVirtual: boolean; // true if we're tracking virtually, false if real bank subaccount
  syncStatus: 'synced' | 'pending' | 'error' | 'not_supported';
  lastSyncDate?: string;
  syncError?: string;
}

export interface SubaccountSettings {
  // Interest calculation settings
  interestEnabled: boolean;
  interestRate?: number; // Annual percentage rate
  interestCompoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'annually';
  
  // Notification preferences
  notifications: {
    balanceUpdates: boolean;
    interestPayments: boolean;
    lowBalanceThreshold?: number;
    goalMilestones: boolean;
  };
  
  // Access restrictions
  restrictions: {
    allowManualWithdrawals: boolean;
    minimumBalance: number;
    withdrawalLimits?: {
      daily?: number;
      monthly?: number;
    };
  };
}

export interface Subaccount {
  id: string;
  goalId: string;
  userId: string;
  
  // Basic info
  name: string;
  description?: string;
  currency: string; // Default 'AUD'
  
  // Balance information
  balance: SubaccountBalance;
  
  // Bank integration
  bankInfo: BankSubaccountInfo;
  
  // Configuration
  settings: SubaccountSettings;
  
  // Audit trail
  createdAt: string;
  updatedAt: string;
  createdBy: string; // User ID who created it
  
  // Status
  status: 'active' | 'suspended' | 'closed';
  statusReason?: string;
}

export interface SubaccountSummary {
  // Quick overview for goal cards
  subaccountId: string;
  currentBalance: number;
  interestEarnedThisMonth: number;
  lastTransactionDate?: string;
  recentTransactions: SubaccountTransaction[];
  projectedGrowth: {
    nextMonth: number;
    nextYear: number;
  };
}

export interface SubaccountCreationRequest {
  goalId: string;
  name: string;
  description?: string;
  sourceAccountId: string; // BASIQ account ID for linking
  settings: {
    interestEnabled?: boolean;
    interestRate?: number;
    notifications?: Partial<SubaccountSettings['notifications']>;
    restrictions?: Partial<SubaccountSettings['restrictions']>;
  };
}

export interface SubaccountTransferRequest {
  subaccountId: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  description?: string;
  sourceAccountId?: string; // For deposits from linked account
  targetAccountId?: string; // For withdrawals to linked account
}

export interface SubaccountBalanceUpdate {
  subaccountId: string;
  newBalance: number;
  timestamp: string;
  source: 'bank_sync' | 'manual_adjustment' | 'transaction';
  reason?: string;
}

// API Response types
export interface SubaccountResponse {
  success: boolean;
  data?: Subaccount;
  error?: string;
  message?: string;
}

export interface SubaccountListResponse {
  success: boolean;
  data?: Subaccount[];
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SubaccountTransactionResponse {
  success: boolean;
  data?: SubaccountTransaction;
  error?: string;
  message?: string;
}

export interface SubaccountTransactionListResponse {
  success: boolean;
  data?: SubaccountTransaction[];
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Growth projection types
export interface GrowthProjection {
  timeframe: 'month' | 'quarter' | 'year';
  projectedAmount: number;
  interestComponent: number;
  transferComponent: number;
  assumptions: {
    currentTransferRate: number;
    averageInterestRate: number;
    transferFrequency: string;
  };
}

export interface SubaccountAnalytics {
  subaccountId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  totalDeposits: number;
  totalWithdrawals: number;
  interestEarned: number;
  netGrowth: number;
  averageBalance: number;
  transactionCount: number;
  growthProjections: GrowthProjection[];
} 