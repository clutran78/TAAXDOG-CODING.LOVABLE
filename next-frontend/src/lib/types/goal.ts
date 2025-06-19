export interface Goal {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  dueDate: string;
  userId: string;
  description?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  // Direct debit configuration for automated savings
  directDebit?: {
    isEnabled: boolean;
    sourceAccountId: string;  // BASIQ account ID
    transferType: 'percentage' | 'fixed';
    transferAmount: number;   // Percentage (0-100) or fixed amount
    frequency: 'weekly' | 'monthly' | 'bi-weekly';
    startDate: string;
    nextTransferDate: string;
    lastTransferDate?: string;
  };
  // Subaccount integration for goal-specific savings isolation
  subaccount?: {
    isEnabled: boolean;
    subaccountId?: string;    // Reference to the Subaccount
    useSubaccountBalance: boolean; // Whether to use subaccount balance for goal progress
  };
}
