import prisma from '../prisma';
import { logger } from '@/lib/logger';
import { BASIQ_CONFIG } from './config';

export class BasiqService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // Authenticate with BASIQ
  private async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const authHeader = Buffer.from(BASIQ_CONFIG.API_KEY).toString('base64');

    const response = await fetch(`${BASIQ_CONFIG.BASE_URL}${BASIQ_CONFIG.ENDPOINTS.TOKEN}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'basiq-version': '3.0',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`BASIQ authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

    if (!this.accessToken) {
      throw new Error('Failed to authenticate with BASIQ API');
    }

    return this.accessToken;
  }

  // Make authenticated request to BASIQ
  private async makeRequest(options: {
    url: string;
    method?: string;
    params?: any;
    body?: any;
  }): Promise<any> {
    const token = await this.authenticate();
    const config = getBasiqConfiguration();

    const url = buildBasiqUrl(options.endpoint, options.params);
    const urlWithQuery = options.query
      ? `${url}?${new URLSearchParams(options.query).toString()}`
      : url;

    const response = await fetch(urlWithQuery, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'basiq-version': '3.0',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    // Log API call
    await this.logApiCall({
      endpoint: options.endpoint,
      method: options.method,
      requestBody: options.body,
      responseStatus: response.status,
      responseBody: await response.text(),
    });

    if (!response.ok) {
      throw new Error(`BASIQ API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Create BASIQ user
  async createUser(userId: string, email: string, mobile?: string): Promise<string> {
    const response = await this.makeRequest({
      method: 'POST',
      endpoint: BASIQ_ENDPOINTS.USERS,
      body: {
        email,
        mobile,
      },
    });

    // Save to database
    await prisma.basiq_users.create({
      data: {
        user_id: userId,
        basiq_user_id: response.id,
        email,
        mobile,
        connection_status: 'active',
      },
    });

    return response.id;
  }

  // Get or create BASIQ user
  async getOrCreateBasiqUser(userId: string): Promise<string> {
    // Check if user already exists
    const existingUser = await prisma.basiq_users.findUnique({
      where: { user_id: userId },
    });

    if (existingUser) {
      return existingUser.basiq_user_id;
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create BASIQ user
    return await this.createUser(userId, user.email, user.phone || undefined);
  }

  // Create consent
  async createConsent(userId: string, institutionId: string): Promise<any> {
    const basiqUserId = await this.getOrCreateBasiqUser(userId);

    const response = await this.makeRequest({
      method: 'POST',
      endpoint: BASIQ_ENDPOINTS.CONSENTS,
      params: { userId: basiqUserId },
      body: {
        institution: institutionId,
        purpose: 'Tax management and financial insights',
        duration: 365, // 1 year
        permissions: ['ACCOUNTS', 'TRANSACTIONS'],
      },
    });

    // Update consent in database
    await prisma.basiq_users.update({
      where: { user_id: userId },
      data: {
        consent_id: response.id,
        consent_status: response.status,
        consent_expires_at: new Date(response.expiresAt),
      },
    });

    return response;
  }

  // Create bank connection
  async createConnection(userId: string, institutionId: string, credentials: any): Promise<any> {
    const basiqUserId = await this.getOrCreateBasiqUser(userId);

    const response = await this.makeRequest({
      method: 'POST',
      endpoint: BASIQ_ENDPOINTS.CONNECTIONS,
      params: { userId: basiqUserId },
      body: {
        institution: institutionId,
        credentials,
      },
    });

    // Save connection to database
    await prisma.bank_connections.create({
      data: {
        basiq_user_id: basiqUserId,
        connection_id: response.id,
        institution_id: institutionId,
        institution_name: response.institution.name,
        institution_short_name: response.institution.shortName,
        institution_logo_url: response.institution.logo?.url,
        status: response.status,
      },
    });

    return response;
  }

  // Sync accounts
  async syncAccounts(userId: string): Promise<void> {
    const basiqUserId = await this.getOrCreateBasiqUser(userId);

    const response = await this.makeRequest({
      method: 'GET',
      endpoint: BASIQ_ENDPOINTS.ACCOUNTS,
      params: { userId: basiqUserId },
    });

    for (const account of response.data) {
      await prisma.bank_accounts.upsert({
        where: { basiq_account_id: account.id },
        create: {
          basiq_user_id: basiqUserId,
          connection_id: account.connection,
          basiq_account_id: account.id,
          account_holder: account.accountHolder,
          account_number: account.accountNumber,
          bsb: account.bsb,
          institution_name: account.institution?.name,
          account_type: account.accountType,
          account_name: account.name,
          balance_available: account.availableBalance?.amount,
          balance_current: account.currentBalance?.amount,
          currency: account.currency || 'AUD',
          is_business_account: account.accountType === 'business',
          last_synced: new Date(),
        },
        update: {
          balance_available: account.availableBalance?.amount,
          balance_current: account.currentBalance?.amount,
          last_synced: new Date(),
        },
      });
    }
  }

  // Sync transactions
  async syncTransactions(userId: string, fromDate?: Date): Promise<void> {
    const basiqUserId = await this.getOrCreateBasiqUser(userId);

    // Get all accounts
    const accounts = await prisma.bank_accounts.findMany({
      where: { basiq_user_id: basiqUserId },
    });

    for (const account of accounts) {
      let hasMore = true;
      let cursor: string | undefined;

      while (hasMore) {
        const query: Record<string, string> = {
          'filter[account]': account.basiq_account_id,
          'page[size]': '500',
        };

        if (fromDate) {
          query['filter[transactionDate.from]'] = fromDate.toISOString().split('T')[0];
        }

        if (cursor) {
          query['page[after]'] = cursor;
        }

        const response = await this.makeRequest({
          method: 'GET',
          endpoint: BASIQ_ENDPOINTS.TRANSACTIONS,
          params: { userId: basiqUserId },
          query,
        });

        for (const transaction of response.data) {
          const category = this.categorizeTransaction(transaction);
          const taxCategory = this.getTaxCategory(transaction, category);
          const gstAmount = this.calculateGST(transaction);

          await prisma.bank_transactions.upsert({
            where: { basiq_transaction_id: transaction.id },
            create: {
              bank_account_id: account.id,
              basiq_transaction_id: transaction.id,
              description: transaction.description,
              amount: Math.abs(transaction.amount),
              transaction_date: new Date(transaction.transactionDate),
              post_date: transaction.postDate ? new Date(transaction.postDate) : null,
              balance: transaction.balance,
              transaction_type: transaction.transactionType,
              direction: transaction.direction,
              category,
              subcategory: transaction.subCategory?.title,
              merchant_name: transaction.merchant?.name,
              is_business_expense: this.isBusinessExpense(transaction, category),
              tax_category: taxCategory,
              gst_amount: gstAmount,
            },
            update: {
              description: transaction.description,
              amount: Math.abs(transaction.amount),
              balance: transaction.balance,
              category,
              subcategory: transaction.subCategory?.title,
              merchant_name: transaction.merchant?.name,
              is_business_expense: this.isBusinessExpense(transaction, category),
              tax_category: taxCategory,
              gst_amount: gstAmount,
            },
          });
        }

        hasMore = response.links?.next !== undefined;
        cursor = response.links?.next?.after;
      }
    }
  }

  // Categorize transaction
  private categorizeTransaction(transaction: any): string {
    const description = transaction.description.toLowerCase();
    const merchant = transaction.merchant?.name?.toLowerCase() || '';

    // Income categories
    if (transaction.direction === 'credit') {
      if (description.includes('salary') || description.includes('wage')) {
        return TRANSACTION_CATEGORIES.SALARY;
      }
      if (description.includes('dividend') || description.includes('distribution')) {
        return TRANSACTION_CATEGORIES.INVESTMENT_INCOME;
      }
      if (description.includes('centrelink') || description.includes('government')) {
        return TRANSACTION_CATEGORIES.GOVERNMENT_BENEFITS;
      }
    }

    // Expense categories
    if (description.includes('rent') || description.includes('mortgage')) {
      return TRANSACTION_CATEGORIES.RENT_MORTGAGE;
    }
    if (
      description.includes('electricity') ||
      description.includes('gas') ||
      description.includes('water')
    ) {
      return TRANSACTION_CATEGORIES.UTILITIES;
    }
    if (
      merchant.includes('woolworths') ||
      merchant.includes('coles') ||
      merchant.includes('aldi')
    ) {
      return TRANSACTION_CATEGORIES.GROCERIES;
    }
    if (
      description.includes('uber') ||
      description.includes('taxi') ||
      description.includes('fuel')
    ) {
      return TRANSACTION_CATEGORIES.TRANSPORT;
    }

    // Default
    return TRANSACTION_CATEGORIES.OTHER;
  }

  // Get tax category
  private getTaxCategory(transaction: any, category: string): string | null {
    if (transaction.direction === 'credit') {
      if (category === TRANSACTION_CATEGORIES.SALARY) {
        return TAX_CATEGORIES.SALARY_WAGES;
      }
      if (category === TRANSACTION_CATEGORIES.INVESTMENT_INCOME) {
        return TAX_CATEGORIES.DIVIDENDS;
      }
    }

    // Check for deductible expenses
    const description = transaction.description.toLowerCase();
    if (description.includes('donation') || description.includes('charity')) {
      return TAX_CATEGORIES.GIFTS_DONATIONS;
    }
    if (description.includes('home office') || description.includes('internet')) {
      return TAX_CATEGORIES.HOME_OFFICE;
    }
    if (description.includes('education') || description.includes('course')) {
      return TAX_CATEGORIES.SELF_EDUCATION;
    }

    return null;
  }

  // Calculate GST (10% if applicable)
  private calculateGST(transaction: any): number | null {
    // Only calculate GST for expenses
    if (transaction.direction !== 'debit') {
      return null;
    }

    // Check if merchant is GST registered (simplified logic)
    const gstMerchants = ['woolworths', 'coles', 'bunnings', 'officeworks'];
    const merchant = transaction.merchant?.name?.toLowerCase() || '';

    if (gstMerchants.some((m) => merchant.includes(m))) {
      return Math.round(Math.abs(transaction.amount) * 0.0909); // GST included price
    }

    return null;
  }

  // Check if business expense
  private isBusinessExpense(transaction: any, category: string): boolean {
    const businessCategories = [
      TRANSACTION_CATEGORIES.BUSINESS_EXPENSE,
      TRANSACTION_CATEGORIES.OFFICE_SUPPLIES,
      TRANSACTION_CATEGORIES.TRAVEL_BUSINESS,
      TRANSACTION_CATEGORIES.PROFESSIONAL_SERVICES,
    ];

    return businessCategories.includes(category);
  }

  // Log API calls
  private async logApiCall(data: {
    endpoint: string;
    method: string;
    requestBody?: any;
    responseStatus: number;
    responseBody: string;
  }): Promise<void> {
    try {
      await prisma.basiq_api_logs.create({
        data: {
          endpoint: data.endpoint,
          method: data.method,
          request_body: data.requestBody || {},
          response_status: data.responseStatus,
          response_body: JSON.parse(data.responseBody),
          duration_ms: 0, // TODO: Implement timing
        },
      });
    } catch (error) {
      logger.error('Failed to log BASIQ API call:', error);
    }
  }

  // Handle webhook
  async handleWebhook(event: string, data: any): Promise<void> {
    await prisma.basiq_webhooks.create({
      data: {
        webhook_id: data.id,
        event_type: event,
        resource_type: data.resourceType,
        resource_id: data.resourceId,
        payload: data,
        status: 'pending',
      },
    });

    // Process webhook based on event type
    switch (event) {
      case 'connection.status.changed':
        await this.handleConnectionStatusChange(data);
        break;
      case 'transactions.created':
        await this.handleTransactionsCreated(data);
        break;
      // Add more handlers as needed
    }
  }

  // Handle connection status change
  private async handleConnectionStatusChange(data: any): Promise<void> {
    await prisma.bank_connections.update({
      where: { connection_id: data.resourceId },
      data: {
        status: data.status,
        updated_at: new Date(),
      },
    });
  }

  // Handle new transactions
  private async handleTransactionsCreated(data: any): Promise<void> {
    // Sync new transactions for the user
    const connection = await prisma.bank_connections.findUnique({
      where: { connection_id: data.connectionId },
      include: { basiq_user: true },
    });

    if (connection?.basiq_user?.user_id) {
      await this.syncTransactions(connection.basiq_user.user_id);
    }
  }
}

// Export singleton instance
export const basiqService = new BasiqService();
