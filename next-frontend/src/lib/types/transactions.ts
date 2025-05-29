export interface Transaction {
  id: string;
  amount: string;
  date: string;
  description: string;
  merchant: string;
  accountName: string;
  category?: string;
}

export interface IncomeSource {
  name: string;
  amount: number;
  percentage: number;
  transactions?: Transaction[];
}
