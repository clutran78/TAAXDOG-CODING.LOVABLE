import prisma from '@/lib/prisma';
import {
  BasiqUser,
  BasiqConnection,
  BasiqAccount,
  BasiqTransaction,
  BankAccountSummary,
  TransactionSummary,
} from './types';
import { basiqClient } from './client';

export class BasiqDatabase {
  // User Management
  async createBasiqUser(userId: string, basiqUserId: string, email: string, mobile?: string) {
    return prisma.basiq_users.create({
      data: {
        user_id: userId,
        basiq_user_id: basiqUserId,
        email,
        mobile,
        connection_status: 'active',
      },
    });
  }

  async getBasiqUser(userId: string) {
    return prisma.basiq_users.findUnique({
      where: { user_id: userId },
    });
  }

  async updateBasiqUserStatus(userId: string, status: string) {
    return prisma.basiq_users.update({
      where: { user_id: userId },
      data: { connection_status: status },
    });
  }

  // Connection Management
  async createBankConnection(
    basiqUserId: string,
    connectionId: string,
    institutionId: string,
    institutionName: string,
    status: string = 'pending',
  ) {
    const basiqUser = await prisma.basiq_users.findUnique({
      where: { basiq_user_id: basiqUserId },
    });

    if (!basiqUser) {
      throw new Error('BASIQ user not found');
    }

    return prisma.bank_connections.create({
      data: {
        basiq_user_id: basiqUser.id,
        connection_id: connectionId,
        institution_id: institutionId,
        institution_name: institutionName,
        status,
      },
    });
  }

  async updateConnectionStatus(connectionId: string, status: string) {
    return prisma.bank_connections.update({
      where: { connection_id: connectionId },
      data: {
        status,
        last_synced: status === 'success' ? new Date() : undefined,
      },
    });
  }

  async getUserConnections(userId: string) {
    const basiqUser = await this.getBasiqUser(userId);
    if (!basiqUser) return [];

    return prisma.bank_connections.findMany({
      where: { basiq_user_id: basiqUser.id },
      orderBy: { created_at: 'desc' },
    });
  }

  // Account Management
  async syncAccounts(userId: string, basiqAccounts: BasiqAccount[]) {
    const basiqUser = await this.getBasiqUser(userId);
    if (!basiqUser) {
      throw new Error('BASIQ user not found');
    }

    // Get existing connections
    const connections = await prisma.bank_connections.findMany({
      where: { basiq_user_id: basiqUser.id },
    });

    const connectionMap = new Map(connections.map((c) => [c.connection_id, c.id]));

    // Sync each account
    for (const account of basiqAccounts) {
      const connectionId = connectionMap.get(account.connection);
      if (!connectionId) continue;

      await prisma.bank_accounts.upsert({
        where: { basiq_account_id: account.id },
        update: {
          account_holder: account.accountHolder,
          account_number: account.accountNo,
          bsb: account.bsb,
          account_type: account.accountType,
          account_name: account.accountName,
          balance_available: account.availableBalance || account.balance,
          balance_current: account.balance,
          currency: account.currency,
          status: account.status,
          last_synced: new Date(),
        },
        create: {
          basiq_user_id: basiqUser.id,
          connection_id: connectionId,
          basiq_account_id: account.id,
          account_holder: account.accountHolder,
          account_number: account.accountNo,
          bsb: account.bsb,
          institution_name: account.institution,
          account_type: account.accountType,
          account_name: account.accountName,
          balance_available: account.availableBalance || account.balance,
          balance_current: account.balance,
          currency: account.currency,
          status: account.status,
          is_business_account: account.accountType?.toLowerCase().includes('business') || false,
          last_synced: new Date(),
        },
      });
    }
  }

  async getUserAccounts(userId: string): Promise<BankAccountSummary[]> {
    const basiqUser = await this.getBasiqUser(userId);
    if (!basiqUser) return [];

    const accounts = await prisma.bank_accounts.findMany({
      where: { basiq_user_id: basiqUser.id },
      include: {
        bank_transactions: {
          select: {
            amount: true,
            is_business_expense: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return accounts.map((account) => {
      const transactions = account.bank_transactions || [];
      const businessExpenses = transactions
        .filter((t) => t.is_business_expense && Number(t.amount) < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      const personalExpenses = transactions
        .filter((t) => !t.is_business_expense && Number(t.amount) < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      return {
        accountId: account.basiq_account_id,
        accountName: account.account_name || account.account_holder || 'Bank Account',
        institutionName: account.institution_name || 'Unknown Bank',
        balance: Number(account.balance_current || 0),
        availableBalance: Number(account.balance_available || 0),
        accountType: account.account_type || 'transaction',
        bsb: account.bsb || undefined,
        accountNumber: account.account_number || '',
        lastSynced: account.last_synced || new Date(),
        transactionCount: transactions.length,
        businessExpenseTotal: businessExpenses,
        personalExpenseTotal: personalExpenses,
      };
    });
  }

  // Transaction Management
  async syncTransactions(accountId: string, basiqTransactions: BasiqTransaction[]) {
    const account = await prisma.bank_accounts.findUnique({
      where: { basiq_account_id: accountId },
    });

    if (!account) {
      throw new Error('Bank account not found');
    }

    // Sync each transaction
    for (const transaction of basiqTransactions) {
      const { taxCategory, isBusinessExpense, gstApplicable } =
        basiqClient.categorizeTransaction(transaction);
      const gstAmount = gstApplicable ? basiqClient.calculateGST(Math.abs(transaction.amount)) : 0;

      await prisma.bank_transactions.upsert({
        where: { basiq_transaction_id: transaction.id },
        update: {
          description: transaction.description,
          amount: transaction.amount,
          transaction_date: new Date(transaction.transactionDate),
          post_date: new Date(transaction.postDate),
          balance: transaction.balance,
          transaction_type: transaction.class,
          direction: transaction.direction,
          category: transaction.category,
          subcategory: transaction.subClass?.title,
          merchant_name: transaction.merchant?.name,
          status: transaction.status,
          is_business_expense: isBusinessExpense,
          tax_category: taxCategory,
          gst_amount: gstAmount,
        },
        create: {
          bank_account_id: account.id,
          basiq_transaction_id: transaction.id,
          description: transaction.description,
          amount: transaction.amount,
          transaction_date: new Date(transaction.transactionDate),
          post_date: new Date(transaction.postDate),
          balance: transaction.balance,
          transaction_type: transaction.class,
          direction: transaction.direction,
          category: transaction.category,
          subcategory: transaction.subClass?.title,
          merchant_name: transaction.merchant?.name,
          status: transaction.status,
          is_business_expense: isBusinessExpense,
          tax_category: taxCategory,
          gst_amount: gstAmount,
        },
      });
    }

    // Update account last synced
    await prisma.bank_accounts.update({
      where: { id: account.id },
      data: { last_synced: new Date() },
    });
  }

  async getTransactionSummary(
    userId: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<TransactionSummary> {
    const basiqUser = await this.getBasiqUser(userId);
    if (!basiqUser) {
      throw new Error('BASIQ user not found');
    }

    const accounts = await prisma.bank_accounts.findMany({
      where: { basiq_user_id: basiqUser.id },
      select: { id: true },
    });

    const accountIds = accounts.map((a) => a.id);

    const where: any = {
      bank_account_id: { in: accountIds },
    };

    if (fromDate || toDate) {
      where.transaction_date = {};
      if (fromDate) where.transaction_date.gte = fromDate;
      if (toDate) where.transaction_date.lte = toDate;
    }

    const transactions = await prisma.bank_transactions.findMany({
      where,
      orderBy: { transaction_date: 'desc' },
    });

    // Calculate summaries
    let totalIncome = 0;
    let totalExpenses = 0;
    let businessExpenses = 0;
    let personalExpenses = 0;
    let gstTotal = 0;
    const categorizedExpenses: { [key: string]: { total: number; count: number; gst: number } } =
      {};
    const monthlyTrends: {
      [key: string]: { income: number; expenses: number; businessExpenses: number };
    } = {};

    for (const transaction of transactions) {
      const amount = Number(transaction.amount);
      const isExpense = amount < 0;
      const absAmount = Math.abs(amount);

      if (isExpense) {
        totalExpenses += absAmount;

        if (transaction.is_business_expense) {
          businessExpenses += absAmount;
        } else {
          personalExpenses += absAmount;
        }

        // Track by category
        const category = transaction.tax_category || 'other';
        if (!categorizedExpenses[category]) {
          categorizedExpenses[category] = { total: 0, count: 0, gst: 0 };
        }
        categorizedExpenses[category].total += absAmount;
        categorizedExpenses[category].count += 1;
        categorizedExpenses[category].gst += Number(transaction.gst_amount || 0);

        gstTotal += Number(transaction.gst_amount || 0);
      } else {
        totalIncome += absAmount;
      }

      // Monthly trends
      const monthKey = transaction.transaction_date.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = { income: 0, expenses: 0, businessExpenses: 0 };
      }

      if (isExpense) {
        monthlyTrends[monthKey].expenses += absAmount;
        if (transaction.is_business_expense) {
          monthlyTrends[monthKey].businessExpenses += absAmount;
        }
      } else {
        monthlyTrends[monthKey].income += absAmount;
      }
    }

    return {
      totalIncome,
      totalExpenses,
      businessExpenses,
      personalExpenses,
      gstTotal,
      categorizedExpenses,
      monthlyTrends,
    };
  }

  // Webhook Management
  async createWebhookRecord(webhookData: any) {
    return prisma.basiq_webhooks.create({
      data: {
        webhook_id: webhookData.id,
        event_type: webhookData.type,
        resource_type: webhookData.data?.type,
        resource_id: webhookData.data?.id,
        payload: webhookData,
        status: 'pending',
      },
    });
  }

  async updateWebhookStatus(webhookId: string, status: string, error?: string) {
    return prisma.basiq_webhooks.update({
      where: { id: webhookId },
      data: {
        status,
        processed_at: status === 'processed' ? new Date() : undefined,
        error_message: error,
      },
    });
  }

  // API Logging
  async logAPICall(
    userId: string | null,
    endpoint: string,
    method: string,
    requestBody: any,
    responseStatus: number,
    responseBody: any,
    duration: number,
    error?: string,
  ) {
    return prisma.basiq_api_logs.create({
      data: {
        user_id: userId,
        endpoint,
        method,
        request_body: requestBody,
        response_status: responseStatus,
        response_body: responseBody,
        error_message: error,
        duration_ms: duration,
      },
    });
  }
}

// Export singleton instance
export const basiqDB = new BasiqDatabase();
