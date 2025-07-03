// BASIQ API Configuration
export const BASIQ_CONFIG = {
  API_KEY: process.env.BASIQ_API_KEY || 'MThmYjA5ZWEtNzRhMi00Nzc5LTk0ZjAtYmRkOTExZDgwMGI4OjhjZjUzZWUzLTYxYm',
  BASE_URL: 'https://au-api.basiq.io',
  AUTH_URL: 'https://au-api.basiq.io/token',
  WEBHOOK_URL: process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/api/basiq/webhook` : 'https://taxreturnpro.com.au/api/basiq/webhook',
  
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
    'groceries': 'personal',
    'restaurants': 'meals_entertainment',
    'fuel': 'vehicle_expenses',
    'transport': 'travel_expenses',
    'utilities': 'utilities',
    'insurance': 'insurance',
    'medical': 'medical_expenses',
    'education': 'education_training',
    'entertainment': 'personal',
    'shopping': 'personal',
    'fees': 'bank_fees',
    'interest': 'interest_charges',
    'transfers': 'transfers',
    'deposits': 'income',
    'withdrawals': 'cash_withdrawals',
    'rent': 'rent',
    'mortgage': 'mortgage',
    'telecommunications': 'phone_internet',
    'subscriptions': 'subscriptions',
    'professional-services': 'professional_fees',
    'office-supplies': 'office_expenses',
    'equipment': 'equipment',
    'software': 'software',
    'advertising': 'advertising',
    'repairs': 'repairs_maintenance',
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