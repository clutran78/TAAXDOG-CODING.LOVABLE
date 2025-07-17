import { SubAccount } from '@/lib/types/subaccount';

export const getSubAccountBalance = async (subaccountId: string): Promise<number> => {
  try {
    const response = await fetch(`/api/subaccounts/${subaccountId}`);
    if (!response.ok) throw new Error('Failed to fetch subaccount');
    const data = await response.json();
    return data.balance || 0;
  } catch (error) {
    console.error('Error fetching subaccount balance:', error);
    return 0;
  }
};