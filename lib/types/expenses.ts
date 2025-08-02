/**
 * Expense-related type definitions
 */

export interface Expense {
  id?: string;
  amount: string | number;
  date: string;
  description?: string;
  merchant?: string;
  category?: string;
  accountName?: string;
}
