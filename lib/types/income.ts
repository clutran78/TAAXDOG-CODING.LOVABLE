/**
 * Income-related type definitions
 */

export interface IncomeSource {
  name: string;
  amount: number;
  percentage: number;
}

export interface IncomeTransactionResult {
  sources: IncomeSource[];
  total: number;
}
