import { BASIQ_CONFIG } from './config';
import { logger } from '@/lib/logger';
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
import {
  BasiqAPIError,
  BasiqErrorCode,
  parseBasiqError,
  RetryStrategy,
  CircuitBreaker,
  ErrorRecovery,
} from './errors';
import prisma from '../prisma';

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 60,
  windowMs: 60000, // 1 minute
  requests: new Map<string, number[]>(),
};

class BasiqAPIClient {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private retryStrategy: RetryStrategy;
  private circuitBreaker: CircuitBreaker;
  private errorRecovery: typeof ErrorRecovery;

  constructor() {
    this.retryStrategy = new RetryStrategy({
      maxAttempts: BASIQ_CONFIG.RETRY.MAX_ATTEMPTS,
      initialDelay: BASIQ_CONFIG.RETRY.INITIAL_DELAY,
      maxDelay: BASIQ_CONFIG.RETRY.MAX_DELAY,
      backoffFactor: BASIQ_CONFIG.RETRY.BACKOFF_FACTOR,
    });
    this.circuitBreaker = new CircuitBreaker();
    this.errorRecovery = ErrorRecovery;
  }

  /**
   * Check rate limit before making request
   */
  private checkRateLimit(endpoint: string): void {
    const now = Date.now();
    const key = `basiq_${endpoint}`;

    if (!RATE_LIMIT.requests.has(key)) {
      RATE_LIMIT.requests.set(key, []);
    }

    const requests = RATE_LIMIT.requests.get(key)!;
    const recentRequests = requests.filter((time) => now - time < RATE_LIMIT.windowMs);

    if (recentRequests.length >= RATE_LIMIT.maxRequests) {
      throw new BasiqAPIError('Rate limit exceeded', BasiqErrorCode.RATE_LIMIT_EXCEEDED, 429, {
        details: {
          endpoint,
          limit: RATE_LIMIT.maxRequests,
          window: RATE_LIMIT.windowMs,
        },
        retryable: true,
        retryAfter: RATE_LIMIT.windowMs / 1000,
      });
    }

    recentRequests.push(now);
    RATE_LIMIT.requests.set(key, recentRequests);
  }

  /**
   * Get or refresh authentication token with retry logic
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      // Implement retry logic for authentication
      const response = await this.retryStrategy.execute(async () => {
        const authResponse = await fetch(BASIQ_CONFIG.AUTH_URL, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(BASIQ_CONFIG.API_KEY).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'basiq-version': '3.0',
          },
          body: 'scope=SERVER_ACCESS',
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!authResponse.ok) {
          const error = await authResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new BasiqAPIError(
            `Authentication failed: ${error.error_description || error.error}`,
            BasiqErrorCode.AUTH_FAILED,
            authResponse.status,
            error,
          );
        }

        return authResponse.json();
      });

      const data: BasiqAuthToken = response;
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000 - 60000); // 1 minute buffer

      // Log successful authentication
      await this.logApiEvent('AUTH_SUCCESS', { expiresIn: data.expires_in });

      return this.accessToken;
    } catch (error) {
      // Log authentication failure
      await this.logApiEvent('AUTH_FAILURE', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Circuit breaker will be handled by execute() method when used
      throw error;
    }
  }

  /**
   * Log API events for monitoring and debugging
   */
  private async logApiEvent(event: string, metadata: any = {}): Promise<void> {
    try {
      // Log to application logger instead of audit log
      // since audit log requires specific AuthEvent enum values
      logger.info(`BASIQ API Event: ${event}`, {
        event: `BASIQ_${event}`,
        userId: metadata.userId || 'system',
        success: !event.includes('FAILURE'),
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to log API event:', error);
    }
  }

  /**
   * Enhanced request method with circuit breaker, retry logic, and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    userId?: string,
  ): Promise<T> {
    // Circuit breaker check is handled by execute() method when wrapping calls

    // Check rate limit
    this.checkRateLimit(endpoint);

    try {
      const response = await this.retryStrategy.execute(async () => {
        const token = await this.getAccessToken();

        const url = `${BASIQ_CONFIG.BASE_URL}${endpoint}`;
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'basiq-version': '3.0',
          'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          ...options.headers,
        };

        const requestOptions: RequestInit = {
          ...options,
          headers,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        };

        const startTime = Date.now();
        const apiResponse = await fetch(url, requestOptions);
        const duration = Date.now() - startTime;

        // Log API request
        await this.logApiEvent('API_REQUEST', {
          endpoint,
          method: options.method || 'GET',
          statusCode: apiResponse.status,
          duration,
          userId,
        });

        if (!apiResponse.ok) {
          // Handle specific error cases
          if (apiResponse.status === 401) {
            // Token expired, clear and retry
            this.accessToken = null;
            this.tokenExpiry = null;
            throw new BasiqAPIError('Token expired', BasiqErrorCode.TOKEN_EXPIRED, 401);
          }

          const errorData = await apiResponse.json().catch(() => ({
            title: 'Unknown Error',
            detail: 'An unexpected error occurred',
          }));

          const error = parseBasiqError(errorData, apiResponse.status);

          // Log API error
          await this.logApiEvent('API_ERROR', {
            endpoint,
            statusCode: apiResponse.status,
            error: error.message,
            errorCode: error.code,
            userId,
          });

          throw error;
        }

        // Success tracking handled by circuit breaker execute() method
        return apiResponse.json();
      });

      return response;
    } catch (error) {
      // Circuit breaker tracking handled by execute() method

      // Handle specific error types
      if (error instanceof BasiqAPIError) {
        if (
          error.code === BasiqErrorCode.AUTH_FAILED ||
          error.code === BasiqErrorCode.TOKEN_EXPIRED
        ) {
          await this.errorRecovery.handleAuthError(error);
        } else if (error.code === BasiqErrorCode.RATE_LIMIT_EXCEEDED) {
          await this.errorRecovery.handleRateLimit(error);
        }
      }

      throw error;
    }
  }

  // User Management with Database Sync
  async createUser(params: CreateUserParams, localUserId: string): Promise<BasiqUser> {
    try {
      const basiqUser = await this.request<BasiqUser>(
        BASIQ_CONFIG.ENDPOINTS.USERS,
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
        localUserId,
      );

      // Note: User model doesn't have basiqUserId field
      // This sync would need to be handled differently,
      // possibly through a separate basiq_users table

      await this.logApiEvent('USER_CREATED', {
        userId: localUserId,
        basiqUserId: basiqUser.id,
      });

      return basiqUser;
    } catch (error) {
      await this.logApiEvent('USER_CREATE_FAILED', {
        userId: localUserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getUser(basiqUserId: string): Promise<BasiqUser> {
    return this.request<BasiqUser>(`${BASIQ_CONFIG.ENDPOINTS.USERS}/${basiqUserId}`);
  }

  async updateUser(
    basiqUserId: string,
    params: Partial<CreateUserParams>,
    localUserId?: string,
  ): Promise<BasiqUser> {
    return this.request<BasiqUser>(
      `${BASIQ_CONFIG.ENDPOINTS.USERS}/${basiqUserId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(params),
      },
      localUserId,
    );
  }

  async deleteUser(basiqUserId: string, localUserId?: string): Promise<void> {
    try {
      await this.request(
        `${BASIQ_CONFIG.ENDPOINTS.USERS}/${basiqUserId}`,
        {
          method: 'DELETE',
        },
        localUserId,
      );

      // Update local database
      if (localUserId) {
        // Note: User model doesn't have basiqUserId field
        // This would need to be handled through basiq_users table
      }
    } catch (error) {
      await this.logApiEvent('USER_DELETE_FAILED', {
        userId: localUserId,
        basiqUserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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

    try {
      const job = await this.request<BasiqJob>(
        endpoint,
        {
          method: 'POST',
        },
        params.userId,
      );

      // Note: bank_accounts table doesn't have userId field
      // Would need to update through basiq_user relation

      // Wait for job completion
      const completedJob = await this.waitForJob(job.id, 120000); // 2 minute timeout

      if (completedJob.status === 'completed') {
        // Note: bank_accounts table doesn't have userId field
        // Would need to update through basiq_user relation

        // Automatically sync new transactions
        const accounts = await this.getAccounts(params.userId);
        for (const account of accounts.data) {
          await this.getTransactions({
            accountId: account.id,
            userId: params.userId!,
            limit: 100,
          });
        }
      } else {
        // Note: bank_accounts table doesn't have userId field
        // Would need to update through basiq_user relation
      }

      return completedJob;
    } catch (error) {
      await this.logApiEvent('CONNECTION_REFRESH_FAILED', {
        userId: params.userId,
        connectionId: params.connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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

  // Transaction Management with Database Sync
  async getTransactions(
    params: GetTransactionsParams & { userId: string },
  ): Promise<{ data: BasiqTransaction[]; synced: number }> {
    const { accountId, fromDate, toDate, limit = 100, offset = 0, userId } = params;
    const endpoint = BASIQ_CONFIG.ENDPOINTS.TRANSACTIONS.replace('{accountId}', accountId);

    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (fromDate) queryParams.append('filter', `transaction.postDate.gte.${fromDate}`);
    if (toDate) queryParams.append('filter', `transaction.postDate.lte.${toDate}`);

    try {
      const response = await this.request<{ data: BasiqTransaction[] }>(
        `${endpoint}?${queryParams.toString()}`,
        {},
        userId,
      );

      // Sync transactions with local database
      const syncedCount = await this.syncTransactions(response.data, accountId, userId);

      return { ...response, synced: syncedCount };
    } catch (error) {
      await this.logApiEvent('GET_TRANSACTIONS_FAILED', {
        userId,
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async getTransaction(
    accountId: string,
    transactionId: string,
    userId?: string,
  ): Promise<BasiqTransaction> {
    const endpoint = `${BASIQ_CONFIG.ENDPOINTS.TRANSACTIONS.replace('{accountId}', accountId)}/${transactionId}`;
    return this.request<BasiqTransaction>(endpoint, {}, userId);
  }

  /**
   * Sync BASIQ transactions with local database
   */
  private async syncTransactions(
    transactions: BasiqTransaction[],
    bankAccountId: string,
    userId: string,
  ): Promise<number> {
    let syncedCount = 0;

    try {
      // Get the bank account from database
      const bankAccount = await prisma.bank_accounts.findFirst({
        where: {
          basiq_account_id: bankAccountId,
        },
      });

      if (!bankAccount) {
        throw new Error(`Bank account ${bankAccountId} not found for user ${userId}`);
      }

      // Process transactions in batches
      const batchSize = 50;
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);

        const upsertPromises = batch.map(async (tx) => {
          const { taxCategory, isBusinessExpense, gstApplicable } = this.categorizeTransaction(tx);

          return prisma.bank_transactions.upsert({
            where: {
              basiq_transaction_id: tx.id,
            },
            update: {
              amount: tx.amount || 0,
              description: tx.description || '',
              transaction_date: new Date(tx.transactionDate || tx.postDate),
              transaction_type: tx.direction === 'credit' ? 'INCOME' : 'EXPENSE',
              category: tx.enrichment?.category?.anzsic?.division?.title || tx.category || 'Other',
              merchant_name: tx.merchant?.name || null,
              tax_category: taxCategory,
              is_business_expense: isBusinessExpense,
              gst_amount: gstApplicable ? this.calculateGST(Math.abs(tx.amount || 0)) : 0,
              updated_at: new Date(),
            },
            create: {
              basiq_transaction_id: tx.id,
              bank_account_id: bankAccount.id,
              amount: tx.amount || 0,
              description: tx.description || '',
              transaction_date: new Date(tx.transactionDate || tx.postDate),
              transaction_type: tx.direction === 'credit' ? 'INCOME' : 'EXPENSE',
              category: tx.enrichment?.category?.anzsic?.division?.title || tx.category || 'Other',
              merchant_name: tx.merchant?.name || null,
              tax_category: taxCategory,
              is_business_expense: isBusinessExpense,
              gst_amount: gstApplicable ? this.calculateGST(Math.abs(tx.amount || 0)) : 0,
            },
          });
        });

        const results = await Promise.allSettled(upsertPromises);
        syncedCount += results.filter((r) => r.status === 'fulfilled').length;
      }

      await this.logApiEvent('TRANSACTIONS_SYNCED', {
        userId,
        bankAccountId,
        totalTransactions: transactions.length,
        syncedCount,
      });

      return syncedCount;
    } catch (error) {
      await this.logApiEvent('TRANSACTION_SYNC_FAILED', {
        userId,
        bankAccountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Institution Management
  async getInstitutions(): Promise<{ data: BasiqInstitution[] }> {
    return this.request<{ data: BasiqInstitution[] }>(BASIQ_CONFIG.ENDPOINTS.INSTITUTIONS);
  }

  async getInstitution(institutionId: string): Promise<BasiqInstitution> {
    return this.request<BasiqInstitution>(
      `${BASIQ_CONFIG.ENDPOINTS.INSTITUTIONS}/${institutionId}`,
    );
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
  validateBankAccountDetails(
    bsb: string,
    accountNumber: string,
    accountName?: string,
  ): {
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
    const category =
      transaction.enrichment?.category?.anzsic?.division?.title?.toLowerCase() ||
      transaction.category?.toLowerCase() ||
      'uncategorized';

    const taxCategory =
      BASIQ_CONFIG.TAX_CATEGORY_MAPPING[
        category as keyof typeof BASIQ_CONFIG.TAX_CATEGORY_MAPPING
      ] || 'other';

    // Business expense detection based on merchant info and category
    const businessKeywords = [
      'office',
      'software',
      'professional',
      'equipment',
      'advertising',
      'telecommunications',
    ];
    const isBusinessExpense = businessKeywords.some(
      (keyword) =>
        transaction.description.toLowerCase().includes(keyword) ||
        transaction.merchant?.name?.toLowerCase().includes(keyword) ||
        category.includes(keyword),
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
    const gstRate = 0.1; // 10% GST
    if (inclusive) {
      // GST inclusive: GST = Total × 10/110
      return Number((totalAmount * (gstRate / (1 + gstRate))).toFixed(2));
    } else {
      // GST exclusive: GST = Total × 10%
      return Number((totalAmount * gstRate).toFixed(2));
    }
  }

  /**
   * Health check for BASIQ API connectivity
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    authenticated: boolean;
    circuitBreakerOpen: boolean;
  }> {
    const startTime = Date.now();
    let authenticated = false;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';

    try {
      // Test authentication
      await this.getAccessToken();
      authenticated = true;

      // Test API endpoint
      await this.getInstitutions();

      const latency = Date.now() - startTime;
      status = latency < 1000 ? 'healthy' : 'degraded';

      return {
        status,
        latency,
        authenticated,
        circuitBreakerOpen: this.circuitBreaker.getState().state === 'OPEN',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        authenticated,
        circuitBreakerOpen: this.circuitBreaker.getState().state === 'OPEN',
      };
    }
  }

  /**
   * Batch sync all user accounts and transactions
   */
  async syncUserBankData(userId: string): Promise<{
    accounts: number;
    transactions: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let accountsSynced = 0;
    let transactionsSynced = 0;

    try {
      // Get user from database
      // Note: User model doesn't have basiqUserId field
      // Need to check basiq_users table instead
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Need to get basiq user ID from basiq_users table
      // For now, this functionality needs to be implemented properly

      // TODO: Get basiq user ID from basiq_users table
      throw new Error('Basiq user sync not implemented - need to query basiq_users table');

      // TODO: Implement basiq user sync when basiq_users table is properly set up
      /*
      for (const connection of connections.data) {
        try {
          // Refresh connection if needed
          if (this.shouldRefreshConnection(connection)) {
            await this.refreshConnection({
              userId: user.basiqUserId,
              connectionId: connection.id,
              localUserId: userId,
            });
          }

          // Get accounts for this connection
          const accounts = await this.getAccounts(user.basiqUserId);

          for (const account of accounts.data) {
            try {
              // Sync account data
              await this.syncBankAccount(account, userId, connection.id);
              accountsSynced++;

              // Sync transactions
              const result = await this.getTransactions({
                accountId: account.id,
                userId: userId,
                limit: 500,
              });
              transactionsSynced += result.synced;
            } catch (error) {
              errors.push(
                `Account ${account.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
            }
          }
        } catch (error) {
          errors.push(
            `Connection ${connection.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      return {
        accounts: accountsSynced,
        transactions: transactionsSynced,
        errors,
      };
      */
    } catch (error) {
      return {
        accounts: 0,
        transactions: 0,
        errors: ['Basiq user sync not implemented'],
      };
    }
  }

  /**
   * Check if connection needs refresh
   */
  private shouldRefreshConnection(connection: BasiqConnection): boolean {
    if (!connection.lastUsed) return true;

    const lastUsedDate = new Date(connection.lastUsed);
    const hoursSinceLastUse = (Date.now() - lastUsedDate.getTime()) / (1000 * 60 * 60);

    // Refresh if not used in last 12 hours
    return hoursSinceLastUse > 12;
  }

  /**
   * Sync BASIQ account with local database
   */
  private async syncBankAccount(
    account: BasiqAccount,
    userId: string,
    connectionId: string,
  ): Promise<void> {
    await prisma.bank_accounts.upsert({
      where: {
        basiq_account_id: account.id,
      },
      update: {
        account_name: account.accountName || 'Bank Account',
        account_number: account.accountNo || '',
        bsb: account.bsb || '',
        balance_available: account.availableBalance || account.balance || 0,
        account_type: account.accountType || 'transaction',
        institution_name: account.institution || '',
        status: 'active',
        last_synced: new Date(),
        updated_at: new Date(),
      },
      create: {
        basiq_user_id: userId, // This should map to the basiq user, not regular user
        basiq_account_id: account.id,
        connection_id: connectionId,
        account_name: account.accountName || 'Bank Account',
        account_number: account.accountNo || '',
        bsb: account.bsb || '',
        balance_available: account.availableBalance || account.balance || 0,
        account_type: account.accountType || 'transaction',
        institution_name: account.institution || '',
        status: 'active',
      },
    });
  }

  /**
   * Get connection status for monitoring
   */
  async getConnectionStatus(userId: string): Promise<{
    connections: Array<{
      id: string;
      institution: string;
      status: string;
      lastRefreshed: Date | null;
      accounts: number;
    }>;
  }> {
    // Note: User model doesn't have basiqUserId field
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return { connections: [] };
    }

    // TODO: Get basiq user ID from basiq_users table
    return { connections: [] };
    // TODO: Implement connection status when basiq integration is complete
    /*
    const connectionStatus = [];

    for (const connection of connections.data) {
      const accounts = await prisma.bank_accounts.count({
        where: {
          connection_id: connection.id,
          userId: userId,
        },
      });

      connectionStatus.push({
        id: connection.id,
        institution: connection.institution || 'Unknown',
        status: connection.status,
        lastRefreshed: connection.lastUsed ? new Date(connection.lastUsed) : null,
        accounts,
      });
    }

    return { connections: connectionStatus };
    */
  }
}

// Export singleton instance
export const basiqClient = new BasiqAPIClient();
export { BasiqAPIClient as BasiqClient };
