// BASIQ API Types and Interfaces

export interface BasiqAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface BasiqUser {
  id: string;
  email: string;
  mobile?: string;
  firstName?: string;
  lastName?: string;
  links?: {
    self: string;
  };
}

export interface BasiqConsent {
  id: string;
  status: 'active' | 'pending' | 'expired' | 'revoked';
  purpose: string;
  duration: number;
  expiresAt: string;
  createdAt: string;
  links?: {
    self: string;
  };
}

export interface BasiqInstitution {
  id: string;
  name: string;
  shortName: string;
  institutionType: string;
  country: string;
  serviceName: string;
  serviceType: string;
  loginIdCaption: string;
  passwordCaption: string;
  tier: string;
  logo: {
    links: {
      square: string;
      full: string;
    };
  };
  colors: {
    primary: string;
    secondary: string;
  };
  features: string[];
  isPopular?: boolean;
}

export interface BasiqConnection {
  id: string;
  status: 'pending' | 'fetching' | 'success' | 'error';
  lastUsed: string;
  institution: {
    id: string;
    name: string;
    shortName: string;
    logo?: {
      links: {
        square: string;
        full: string;
      };
    };
  };
  links?: {
    self: string;
  };
}

export interface BasiqAccount {
  id: string;
  accountNo: string;
  accountHolder: string;
  accountType: string;
  accountName?: string;
  balance: number;
  availableBalance?: number;
  currency: string;
  institution: string;
  connection: string;
  status: 'available' | 'unavailable';
  lastUpdated: string;
  bsb?: string; // Australian BSB
  links?: {
    self: string;
    transactions: string;
  };
}

export interface BasiqTransaction {
  id: string;
  status: 'posted' | 'pending';
  description: string;
  amount: number;
  account: string;
  balance?: number;
  direction: 'credit' | 'debit';
  class: string;
  transactionDate: string;
  postDate: string;
  subClass?: {
    title: string;
    code: string;
  };
  category?: string;
  merchant?: {
    name: string;
    location?: string;
  };
  enrichment?: {
    category: {
      anzsic: {
        division: {
          code: string;
          title: string;
        };
        subdivision?: {
          code: string;
          title: string;
        };
        group?: {
          code: string;
          title: string;
        };
        class?: {
          code: string;
          title: string;
        };
      };
    };
    merchant?: {
      id: string;
      name: string;
      businessName: string;
      website?: string;
      abn?: string; // Australian Business Number
      phoneNumber?: string;
      email?: string;
    };
    location?: {
      country: string;
      state?: string;
      city?: string;
      postcode?: string;
      line1?: string;
    };
  };
  links?: {
    self: string;
    account: string;
  };
}

export interface BasiqJob {
  id: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: {
    type: string;
    url: string;
  };
  error?: {
    type: string;
    title: string;
    detail: string;
    correlationId: string;
  };
  links?: {
    self: string;
    source: string;
  };
}

export interface BasiqWebhookEvent {
  id: string;
  type: string;
  time: string;
  data: {
    type: string;
    id: string;
    links?: {
      self: string;
    };
  };
}

export interface BasiqError {
  type: string;
  title: string;
  detail: string;
  correlationId: string;
  source?: {
    parameter?: string;
    pointer?: string;
  };
}

export interface CreateUserParams {
  email: string;
  mobile?: string;
  firstName?: string;
  lastName?: string;
}

export interface CreateConnectionParams {
  loginId: string;
  password: string;
  institution: string;
  securityCode?: string;
}

export interface CreateConsentParams {
  purpose: string;
  duration: number; // in seconds
  permissions: string[];
}

export interface GetTransactionsParams {
  accountId: string;
  fromDate?: string; // ISO date
  toDate?: string; // ISO date
  limit?: number;
  offset?: number;
}

export interface RefreshConnectionParams {
  userId: string;
  connectionId: string;
}

export interface TaxCategoryMapping {
  basiqCategory: string;
  taxCategory: string;
  isBusinessExpense: boolean;
  gstApplicable: boolean;
}

export interface BankAccountSummary {
  accountId: string;
  accountName: string;
  institutionName: string;
  balance: number;
  availableBalance: number;
  accountType: string;
  bsb?: string;
  accountNumber: string;
  lastSynced: Date;
  transactionCount: number;
  businessExpenseTotal: number;
  personalExpenseTotal: number;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  businessExpenses: number;
  personalExpenses: number;
  gstTotal: number;
  categorizedExpenses: {
    [category: string]: {
      total: number;
      count: number;
      gst: number;
    };
  };
  monthlyTrends: {
    [month: string]: {
      income: number;
      expenses: number;
      businessExpenses: number;
    };
  };
}
