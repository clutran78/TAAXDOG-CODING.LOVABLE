/**
 * BASIQ Accounts Service
 * Handles fetching bank account data from BASIQ API for direct debit setup
 */

import { getData } from './api/apiController';

export interface BasiqAccount {
  id: string;
  name: string;
  balance?: number;
  availableBalance?: number;
  accountType?: string;
  accountNumber?: string;
  bsb?: string;
  institution?: {
    id: string;
    name: string;
    shortName?: string;
  };
  connection?: {
    id: string;
    status: string;
  };
}

export interface BasiqAccountsResponse {
  success: boolean;
  accounts?: {
    data: BasiqAccount[];
    count?: number;
    links?: any;
  };
  error?: string;
  message?: string;
}

/**
 * Fetch all bank accounts for the authenticated user
 * @returns Promise<BasiqAccountsResponse>
 */
export const fetchUserBankAccounts = async (): Promise<BasiqAccountsResponse> => {
  try {
    const data = await getData('/api/banking/accounts');
    return data;
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch bank accounts',
    };
  }
};

/**
 * Get accounts suitable for direct debit (typically checking/savings accounts)
 * Filters out credit cards and other unsuitable account types
 * @returns Promise<BasiqAccount[]>
 */
export const getDirectDebitEligibleAccounts = async (): Promise<BasiqAccount[]> => {
  try {
    const response = await fetchUserBankAccounts();
    
    if (!response.success || !response.accounts?.data) {
      return [];
    }

    // Filter accounts suitable for direct debit
    return response.accounts.data.filter(account => {
      // Include checking, savings, and transaction accounts
      // Exclude credit cards, loans, and investment accounts
      const accountType = account.accountType?.toLowerCase() || '';
      const accountName = account.name?.toLowerCase() || '';
      
      const isEligible = 
        !accountType.includes('credit') &&
        !accountType.includes('loan') &&
        !accountType.includes('mortgage') &&
        !accountType.includes('investment') &&
        !accountName.includes('credit') &&
        !accountName.includes('loan') &&
        account.connection?.status === 'active';
        
      return isEligible;
    });
  } catch (error) {
    console.error('Error filtering eligible accounts:', error);
    return [];
  }
};

/**
 * Format account display name for UI
 * @param account BasiqAccount
 * @returns string
 */
export const formatAccountDisplayName = (account: BasiqAccount): string => {
  const institutionName = account.institution?.shortName || account.institution?.name || 'Bank';
  const accountNumber = account.accountNumber ? `****${account.accountNumber.slice(-4)}` : '';
  
  if (accountNumber) {
    return `${account.name} (${institutionName} ${accountNumber})`;
  }
  return `${account.name} (${institutionName})`;
};

/**
 * Get account balance for display
 * @param account BasiqAccount
 * @returns number
 */
export const getAccountBalance = (account: BasiqAccount): number => {
  return account.availableBalance ?? account.balance ?? 0;
};

/**
 * Validate if an account has sufficient balance for a transfer
 * @param account BasiqAccount
 * @param transferAmount number
 * @returns boolean
 */
export const validateAccountBalance = (account: BasiqAccount, transferAmount: number): boolean => {
  const balance = getAccountBalance(account);
  return balance >= transferAmount && transferAmount > 0;
};

/**
 * Calculate estimated transfer amount based on type and account balance
 * @param account BasiqAccount
 * @param transferType 'percentage' | 'fixed'
 * @param transferAmount number
 * @returns number
 */
export const calculateTransferAmount = (
  account: BasiqAccount, 
  transferType: 'percentage' | 'fixed', 
  transferAmount: number
): number => {
  if (transferType === 'fixed') {
    return transferAmount;
  }
  
  const balance = getAccountBalance(account);
  return (balance * transferAmount) / 100;
}; 