import { BASIQ_CONFIG } from './config';
import {
  BasiqAuthToken,
  BasiqUser,
  BasiqConnection,
  BasiqAccount,
  BasiqTransaction,
  BasiqInstitution,
  BasiqConsent,
  BasiqJob,
  BasiqError,
  CreateUserParams,
  CreateConnectionParams,
  CreateConsentParams,
  GetTransactionsParams,
  RefreshConnectionParams,
} from './types';
import { bankingValidators } from './validation';
import { BasiqAPIError, parseBasiqError, RetryStrategy, CircuitBreaker, ErrorRecovery } from './errors';

class BasiqAPIClient {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private retryStrategy: RetryStrategy;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.retryStrategy = new RetryStrategy({
      maxAttempts: BASIQ_CONFIG.RETRY.MAX_ATTEMPTS,
      initialDelay: BASIQ_CONFIG.RETRY.INITIAL_DELAY,
      maxDelay: BASIQ_CONFIG.RETRY.MAX_DELAY,
      backoffFactor: BASIQ_CONFIG.RETRY.BACKOFF_FACTOR,
    });
    this.circuitBreaker = new CircuitBreaker();
  }

  // Authentication
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const response = await fetch(BASIQ_CONFIG.AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(BASIQ_CONFIG.API_KEY).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'basiq-version': '3.0',
      },
      body: 'scope=SERVER_ACCESS',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Authentication failed: ${error.error_description || error.error}`);
    }

    const data: BasiqAuthToken = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));

    return this.accessToken;
  }

  // Generic request method with retry logic
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = BASIQ_CONFIG.RETRY.MAX_ATTEMPTS
  ): Promise<T> {
    const token = await this.getAccessToken();
    
    const url = `${BASIQ_CONFIG.BASE_URL}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'basiq-version': '3.0',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        if (response.status === 401 && retries > 0) {
          // Token might be expired, clear it and retry
          this.accessToken = null;
          this.tokenExpiry = null;
          return this.request<T>(endpoint, options, retries - 1);
        }

        const error: BasiqError = await response.json();
        throw new Error(`BASIQ API Error: ${error.title} - ${error.detail}`);
      }

      return response.json();
    } catch (error) {
      if (retries > 0) {
        // Exponential backoff
        const delay = Math.min(
          BASIQ_CONFIG.RETRY.INITIAL_DELAY * Math.pow(BASIQ_CONFIG.RETRY.BACKOFF_FACTOR, BASIQ_CONFIG.RETRY.MAX_ATTEMPTS - retries),
          BASIQ_CONFIG.RETRY.MAX_DELAY
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  // User Management
  async createUser(params: CreateUserParams): Promise<BasiqUser> {
    return this.request<BasiqUser>(BASIQ_CONFIG.ENDPOINTS.USERS, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getUser(userId: string): Promise<BasiqUser> {
    return this.request<BasiqUser>(`${BASIQ_CONFIG.ENDPOINTS.USERS}/${userId}`);
  }

  async updateUser(userId: string, params: Partial<CreateUserParams>): Promise<BasiqUser> {
    return this.request<BasiqUser>(`${BASIQ_CONFIG.ENDPOINTS.USERS}/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request(`${BASIQ_CONFIG.ENDPOINTS.USERS}/${userId}`, {
      method: 'DELETE',
    });
  }

  // Consent Management
  async createConsent(userId: string, params: CreateConsentParams): Promise<BasiqConsent> {
    const endpoint = BASIQ_CONFIG.ENDPOINTS.CONSENTS.replace('{userId}', userId);
    return this.request<BasiqConsent>(endpoint, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getConsent(userId: string, consentId: string): Promise<BasiqConsent> {
    const endpoint = `${BASIQ_CONFIG.ENDPOINTS.CONSENTS.replace('{userId}', userId)}/${consentId}`;
    return this.request<BasiqConsent>(endpoint);
  }

  // Connection Management
  async createConnection(userId: string, params: CreateConnectionParams): Promise<BasiqJob> {
    const endpoint = BASIQ_CONFIG.ENDPOINTS.CONNECTIONS.replace('{userId}', userId);
    return this.request<BasiqJob>(endpoint, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getConnections(userId: string): Promise<{ data: BasiqConnection[] }> {
    const endpoint = BASIQ_CONFIG.ENDPOINTS.CONNECTIONS.replace('{userId}', userId);
    return this.request<{ data: BasiqConnection[] }>(endpoint);
  }

  async getConnection(userId: string, connectionId: string): Promise<BasiqConnection> {
    const endpoint = `${BASIQ_CONFIG.ENDPOINTS.CONNECTIONS.replace('{userId}', userId)}/${connectionId}`;
    return this.request<BasiqConnection>(endpoint);
  }

  async refreshConnection(params: RefreshConnectionParams): Promise<BasiqJob> {
    const endpoint = `${BASIQ_CONFIG.ENDPOINTS.CONNECTIONS.replace('{userId}', params.userId)}/${params.connectionId}/refresh`;
    return this.request<BasiqJob>(endpoint, {
      method: 'POST',
    });
  }

  async deleteConnection(userId: string, connectionId: string): Promise<void> {
    const endpoint = `${BASIQ_CONFIG.ENDPOINTS.CONNECTIONS.replace('{userId}', userId)}/${connectionId}`;
    await this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // Account Management
  async getAccounts(userId: string): Promise<{ data: BasiqAccount[] }> {
    const endpoint = BASIQ_CONFIG.ENDPOINTS.ACCOUNTS.replace('{userId}', userId);
    return this.request<{ data: BasiqAccount[] }>(endpoint);
  }

  async getAccount(userId: string, accountId: string): Promise<BasiqAccount> {
    const endpoint = `${BASIQ_CONFIG.ENDPOINTS.ACCOUNTS.replace('{userId}', userId)}/${accountId}`;
    return this.request<BasiqAccount>(endpoint);
  }

  // Transaction Management
  async getTransactions(params: GetTransactionsParams): Promise<{ data: BasiqTransaction[] }> {
    const { accountId, fromDate, toDate, limit = 100, offset = 0 } = params;
    const endpoint = BASIQ_CONFIG.ENDPOINTS.TRANSACTIONS.replace('{accountId}', accountId);
    
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (fromDate) queryParams.append('filter', `transaction.postDate.gte.${fromDate}`);
    if (toDate) queryParams.append('filter', `transaction.postDate.lte.${toDate}`);

    return this.request<{ data: BasiqTransaction[] }>(`${endpoint}?${queryParams.toString()}`);
  }

  async getTransaction(accountId: string, transactionId: string): Promise<BasiqTransaction> {
    const endpoint = `${BASIQ_CONFIG.ENDPOINTS.TRANSACTIONS.replace('{accountId}', accountId)}/${transactionId}`;
    return this.request<BasiqTransaction>(endpoint);
  }

  // Institution Management
  async getInstitutions(): Promise<{ data: BasiqInstitution[] }> {
    return this.request<{ data: BasiqInstitution[] }>(BASIQ_CONFIG.ENDPOINTS.INSTITUTIONS);
  }

  async getInstitution(institutionId: string): Promise<BasiqInstitution> {
    return this.request<BasiqInstitution>(`${BASIQ_CONFIG.ENDPOINTS.INSTITUTIONS}/${institutionId}`);
  }

  // Job Management
  async getJob(jobId: string): Promise<BasiqJob> {
    const endpoint = BASIQ_CONFIG.ENDPOINTS.JOBS.replace('{jobId}', jobId);
    return this.request<BasiqJob>(endpoint);
  }

  async waitForJob(jobId: string, maxWaitTime = 60000): Promise<BasiqJob> {
    const startTime = Date.now();
    let job: BasiqJob;

    while (Date.now() - startTime < maxWaitTime) {
      job = await this.getJob(jobId);

      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Job ${jobId} timed out after ${maxWaitTime}ms`);
  }

  // Helper method to validate BSB
  validateBSB(bsb: string): boolean {
    const validation = bankingValidators.validateBSB(bsb);
    return validation.valid;
  }

  // Helper method to validate account number
  validateAccountNumber(accountNumber: string, bsb?: string): boolean {
    const validation = bankingValidators.validateAccountNumber(accountNumber, bsb);
    return validation.valid;
  }

  // Get formatted BSB
  formatBSB(bsb: string): string | null {
    const validation = bankingValidators.validateBSB(bsb);
    return validation.valid ? validation.formatted! : null;
  }

  // Get bank name from BSB
  getBankName(bsb: string): string | null {
    return bankingValidators.getBankFromBSB(bsb);
  }

  // Validate complete bank account
  validateBankAccountDetails(bsb: string, accountNumber: string, accountName?: string): {
    valid: boolean;
    errors: string[];
    formatted?: { bsb: string; accountNumber: string };
  } {
    return bankingValidators.validateBankAccount({ bsb, accountNumber, accountName });
  }

  // Helper method to categorize transaction for tax purposes
  categorizeTransaction(transaction: BasiqTransaction): {
    taxCategory: string;
    isBusinessExpense: boolean;
    gstApplicable: boolean;
  } {
    const category = transaction.enrichment?.category?.anzsic?.division?.title?.toLowerCase() || 
                    transaction.category?.toLowerCase() || 
                    'uncategorized';

    const taxCategory = BASIQ_CONFIG.TAX_CATEGORY_MAPPING[category] || 'other';
    
    // Business expense detection based on merchant info and category
    const businessKeywords = ['office', 'software', 'professional', 'equipment', 'advertising', 'telecommunications'];
    const isBusinessExpense = businessKeywords.some(keyword => 
      transaction.description.toLowerCase().includes(keyword) ||
      transaction.merchant?.name?.toLowerCase().includes(keyword) ||
      category.includes(keyword)
    );

    // GST is applicable for most business expenses in Australia
    const gstApplicable = isBusinessExpense && taxCategory !== 'personal';

    return {
      taxCategory,
      isBusinessExpense,
      gstApplicable,
    };
  }

  // Calculate GST from total amount (GST is 10% in Australia)
  calculateGST(totalAmount: number, inclusive = true): number {
    const gstRate = 0.10; // 10% GST
    if (inclusive) {
      // GST inclusive: GST = Total × 10/110
      return Number((totalAmount * (gstRate / (1 + gstRate))).toFixed(2));
    } else {
      // GST exclusive: GST = Total × 10%
      return Number((totalAmount * gstRate).toFixed(2));
    }
  }
}

// Export singleton instance
export const basiqClient = new BasiqAPIClient();