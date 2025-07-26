import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiResponse } from '@/lib/api/response';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  category: string | null;
  taxCategory: string | null;
  isBusinessExpense: boolean;
  gstAmount: number | null;
  userId: string;
  bankAccountId: string;
  receiptId: string | null;
}

interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  taxCategory?: string;
  isBusinessExpense?: boolean;
  bankAccountId?: string;
  search?: string;
  sortBy?: 'date' | 'amount' | 'category';
  sortOrder?: 'asc' | 'desc';
}

interface TransactionResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    averageTransaction: number;
    transactionCount: number;
  };
}

// Query keys
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters?: TransactionFilters) => [...transactionKeys.lists(), filters] as const,
  infinite: (filters?: TransactionFilters) => [...transactionKeys.all, 'infinite', filters] as const,
  detail: (id: string) => [...transactionKeys.all, 'detail', id] as const,
  summary: (period: string) => [...transactionKeys.all, 'summary', period] as const,
};

/**
 * Fetch transactions from API
 */
async function fetchTransactions(
  filters?: TransactionFilters & { page?: number; limit?: number }
): Promise<TransactionResponse> {
  const params = new URLSearchParams();
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
  }
  
  const response = await fetch(`/api/transactions?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Hook to fetch paginated transactions
 */
export function useTransactions(
  filters?: TransactionFilters,
  page = 1,
  limit = 20
) {
  return useQuery({
    queryKey: transactionKeys.list({ ...filters, page, limit }),
    queryFn: () => fetchTransactions({ ...filters, page, limit }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch infinite scroll transactions
 */
export function useInfiniteTransactions(
  filters?: TransactionFilters,
  limit = 20
) {
  return useInfiniteQuery({
    queryKey: transactionKeys.infinite(filters),
    queryFn: ({ pageParam = 1 }) => 
      fetchTransactions({ ...filters, page: pageParam, limit }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.pagination.hasMore) {
        return pages.length + 1;
      }
      return undefined;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to update a transaction
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string; 
      data: Partial<Transaction> 
    }) => {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update transaction');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update specific transaction in cache
      queryClient.setQueryData(
        transactionKeys.detail(variables.id), 
        data.data
      );
      
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ 
        queryKey: transactionKeys.lists() 
      });
    },
  });
}

/**
 * Hook to bulk categorize transactions
 */
export function useBulkCategorizeTransactions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      transactionIds, 
      category, 
      taxCategory 
    }: { 
      transactionIds: string[]; 
      category?: string;
      taxCategory?: string;
    }) => {
      const response = await fetch('/api/transactions/bulk-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds, category, taxCategory }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to categorize transactions');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all transaction queries to refetch
      queryClient.invalidateQueries({ 
        queryKey: transactionKeys.all 
      });
    },
  });
}

/**
 * Hook to prefetch transactions for a specific period
 */
export function usePrefetchTransactions() {
  const queryClient = useQueryClient();
  
  return (filters?: TransactionFilters) => {
    queryClient.prefetchQuery({
      queryKey: transactionKeys.list(filters),
      queryFn: () => fetchTransactions(filters),
      staleTime: 2 * 60 * 1000,
    });
  };
}