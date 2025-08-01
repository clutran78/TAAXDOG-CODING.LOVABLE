// BASIQ API Configuration
export const BASIQ_CONFIG = {
  API_KEY:
    process.env.BASIQ_API_KEY ||
    'MThmYjA5ZWEtNzRhMi00Nzc5LTk0ZjAtYmRkOTExZDgwMGI4OjhjZjUzZWUzLTYxYm',
  BASE_URL: 'https://au-api.basiq.io',
  AUTH_URL: 'https://au-api.basiq.io/token',
  WEBHOOK_URL: process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/basiq/webhook`
    : 'https://taxreturnpro.com.au/api/basiq/webhook',

  // API Endpoints
  ENDPOINTS: {
    TOKEN: '/token',
    USERS: '/users',
    CONNECTIONS: '/users/{userId}/connections',
    ACCOUNTS: '/users/{userId}/accounts',
    TRANSACTIONS: '/accounts/{accountId}/transactions',
    INSTITUTIONS: '/institutions',
    CONSENTS: '/users/{userId}/consents',
    JOBS: '/jobs/{jobId}',
  },

  // Scopes for different operations
  SCOPES: {
    CLIENT_ACCESS: 'CLIENT_ACCESS',
    SERVER_ACCESS: 'SERVER_ACCESS',
  },

  // Institution IDs for major Australian banks
  INSTITUTIONS: {
    CBA: 'AU00000',
    ANZ: 'AU00001',
    WESTPAC: 'AU00002',
    NAB: 'AU00003',
    BANK_OF_QUEENSLAND: 'AU00004',
    BENDIGO_BANK: 'AU00005',
    ING: 'AU00006',
    MACQUARIE: 'AU00007',
    SUNCORP: 'AU00008',
    BANK_SA: 'AU00009',
    ST_GEORGE: 'AU00010',
    BANK_OF_MELBOURNE: 'AU00011',
    ME_BANK: 'AU00012',
    HSBC: 'AU00013',
    CITIBANK: 'AU00014',
  },

  // Transaction categories mapped to ATO tax categories
  TAX_CATEGORY_MAPPING: {
    groceries: 'personal',
    restaurants: 'meals_entertainment',
    fuel: 'vehicle_expenses',
    transport: 'travel_expenses',
    utilities: 'utilities',
    insurance: 'insurance',
    medical: 'medical_expenses',
    education: 'education_training',
    entertainment: 'personal',
    shopping: 'personal',
    fees: 'bank_fees',
    interest: 'interest_charges',
    transfers: 'transfers',
    deposits: 'income',
    withdrawals: 'cash_withdrawals',
    rent: 'rent',
    mortgage: 'mortgage',
    telecommunications: 'phone_internet',
    subscriptions: 'subscriptions',
    'professional-services': 'professional_fees',
    'office-supplies': 'office_expenses',
    equipment: 'equipment',
    software: 'software',
    advertising: 'advertising',
    repairs: 'repairs_maintenance',
  },

  // Webhook event types
  WEBHOOK_EVENTS: {
    CONNECTION_CREATED: 'connection.created',
    CONNECTION_UPDATED: 'connection.updated',
    CONNECTION_DELETED: 'connection.deleted',
    ACCOUNT_CREATED: 'account.created',
    ACCOUNT_UPDATED: 'account.updated',
    ACCOUNT_DELETED: 'account.deleted',
    TRANSACTIONS_CREATED: 'transactions.created',
    TRANSACTIONS_UPDATED: 'transactions.updated',
    JOB_COMPLETED: 'job.completed',
    JOB_FAILED: 'job.failed',
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 10000,
    BACKOFF_FACTOR: 2,
  },

  // Rate limiting
  RATE_LIMITS: {
    REQUESTS_PER_SECOND: 10,
    REQUESTS_PER_MINUTE: 300,
    REQUESTS_PER_HOUR: 10000,
  },

  // Australian BSB validation regex
  BSB_REGEX: /^[0-9]{3}-?[0-9]{3}$/,

  // Account number validation (Australian standard)
  ACCOUNT_NUMBER_REGEX: /^[0-9]{5,9}$/,
};

// BASIQ API Endpoints (for backward compatibility)
export const BASIQ_ENDPOINTS = BASIQ_CONFIG.ENDPOINTS;

// Transaction Categories
export const TRANSACTION_CATEGORIES = {
  // Income categories
  SALARY: 'salary',
  INVESTMENT_INCOME: 'investment_income',
  GOVERNMENT_BENEFITS: 'government_benefits',
  RENTAL_INCOME: 'rental_income',
  BUSINESS_INCOME: 'business_income',
  OTHER_INCOME: 'other_income',

  // Expense categories
  RENT_MORTGAGE: 'rent_mortgage',
  UTILITIES: 'utilities',
  GROCERIES: 'groceries',
  TRANSPORT: 'transport',
  FUEL: 'fuel',
  INSURANCE: 'insurance',
  MEDICAL: 'medical',
  EDUCATION: 'education',
  ENTERTAINMENT: 'entertainment',
  SHOPPING: 'shopping',
  RESTAURANTS: 'restaurants',
  BUSINESS_EXPENSE: 'business_expense',
  OFFICE_SUPPLIES: 'office_supplies',
  TRAVEL_BUSINESS: 'travel_business',
  PROFESSIONAL_SERVICES: 'professional_services',
  SUBSCRIPTIONS: 'subscriptions',
  BANK_FEES: 'bank_fees',
  OTHER: 'other',
};

// Tax Categories (aligned with ATO categories)
export const TAX_CATEGORIES = {
  // Income categories
  SALARY_WAGES: 'salary_wages',
  DIVIDENDS: 'dividends',
  INTEREST: 'interest',
  RENTAL_INCOME: 'rental_income',
  BUSINESS_INCOME: 'business_income',

  // Deductible expense categories
  WORK_RELATED_EXPENSES: 'work_related_expenses',
  GIFTS_DONATIONS: 'gifts_donations',
  HOME_OFFICE: 'home_office',
  SELF_EDUCATION: 'self_education',
  VEHICLE_EXPENSES: 'vehicle_expenses',
  TRAVEL_EXPENSES: 'travel_expenses',
  PROFESSIONAL_DEVELOPMENT: 'professional_development',
  EQUIPMENT_DEPRECIATION: 'equipment_depreciation',
  REPAIRS_MAINTENANCE: 'repairs_maintenance',
  INSURANCE_DEDUCTIBLE: 'insurance_deductible',
};

// Utility functions for BASIQ API
export function getBasiqConfiguration() {
  return {
    baseUrl: BASIQ_CONFIG.BASE_URL,
    apiKey: BASIQ_CONFIG.API_KEY,
    webhookUrl: BASIQ_CONFIG.WEBHOOK_URL,
    endpoints: BASIQ_CONFIG.ENDPOINTS,
    retry: BASIQ_CONFIG.RETRY,
    rateLimits: BASIQ_CONFIG.RATE_LIMITS,
  };
}

export function buildBasiqUrl(endpoint: string, params?: Record<string, string>): string {
  let url = `${BASIQ_CONFIG.BASE_URL}${endpoint}`;

  // Replace URL parameters
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`{${key}}`, value);
    }
  }

  return url;
}
