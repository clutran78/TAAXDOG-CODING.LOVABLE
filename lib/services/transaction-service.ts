import { logger } from '@/lib/logger';
import { showToast } from '@/lib/utils/helpers';

/**
 * Transaction Service
 * Handles bank transaction operations using PostgreSQL via Next.js API routes
 */

export interface BankTransaction {
  id: string;
  accountId: string;
  amount: number;
  description: string;
  date: string;
  type: 'CREDIT' | 'DEBIT';
  category?: string;
  merchant?: string;
  status: string;
  basiqTransactionId?: string;
}

// Fetch bank transactions from BASIQ integration
export const fetchBankTransactions = async (accountId?: string): Promise<BankTransaction[]> => {
  try {
    const url = accountId 
      ? `/api/basiq/transactions?accountId=${accountId}`
      : '/api/basiq/transactions';
      
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch bank transactions');
    }

    const data = await response.json();
    return data.data || data.transactions || [];
  } catch (error) {
    logger.error('Error fetching bank transactions:', error);
    showToast('Error loading bank transactions', 'danger');
    return [];
  }
};

// Sync bank transactions from BASIQ
export const syncBankTransactions = async (accountId?: string): Promise<{ synced: number; updated: number }> => {
  try {
    const response = await fetch('/api/basiq/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ accountId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync bank transactions');
    }

    const result = await response.json();
    const { synced = 0, updated = 0 } = result.data || result;
    
    showToast(`Synced ${synced} new transactions, updated ${updated}`, 'success');
    return { synced, updated };
  } catch (error) {
    logger.error('Error syncing bank transactions:', error);
    showToast('Error syncing bank transactions', 'danger');
    throw error;
  }
};

// Categorize a transaction
export const categorizeTransaction = async (
  transactionId: string, 
  category: string
): Promise<BankTransaction> => {
  try {
    const response = await fetch(`/api/transactions/${transactionId}/categorize`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ category }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to categorize transaction');
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    logger.error('Error categorizing transaction:', error);
    showToast('Error categorizing transaction', 'danger');
    throw error;
  }
};

// Get transaction summary/analytics
export const getTransactionSummary = async (params?: {
  startDate?: string;
  endDate?: string;
  accountId?: string;
}): Promise<{
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  categoryBreakdown: Record<string, number>;
  monthlyTrend: Array<{ month: string; income: number; expenses: number }>;
}> => {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.accountId) queryParams.append('accountId', params.accountId);
    
    const response = await fetch(`/api/transactions/summary?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch transaction summary');
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    logger.error('Error fetching transaction summary:', error);
    throw error;
  }
};

// Search transactions
export const searchTransactions = async (query: string): Promise<BankTransaction[]> => {
  try {
    const response = await fetch(`/api/transactions/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to search transactions');
    }

    const data = await response.json();
    return data.data || data.transactions || [];
  } catch (error) {
    logger.error('Error searching transactions:', error);
    return [];
  }
};

// Export transactions
export const exportTransactions = async (format: 'csv' | 'pdf', params?: {
  startDate?: string;
  endDate?: string;
  accountId?: string;
}): Promise<Blob> => {
  try {
    const queryParams = new URLSearchParams({ format });
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.accountId) queryParams.append('accountId', params.accountId);
    
    const response = await fetch(`/api/transactions/export?${queryParams}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to export transactions');
    }

    return await response.blob();
  } catch (error) {
    logger.error('Error exporting transactions:', error);
    showToast('Error exporting transactions', 'danger');
    throw error;
  }
};