export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bsb?: string;
  balance: number;
  institutionName: string;
  type: 'transaction' | 'savings' | 'credit' | 'loan';
}

export const fetchLinkedAccounts = async (): Promise<BankAccount[]> => {
  try {
    const response = await fetch('/api/basiq/accounts');
    if (!response.ok) throw new Error('Failed to fetch accounts');
    return await response.json();
  } catch (error) {
    console.error('Error fetching linked accounts:', error);
    return [];
  }
};