import { QueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

/**
 * React Query client configuration
 * Optimized for performance with sensible defaults
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: How long before data is considered stale
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Cache time: How long to keep data in cache after component unmounts
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      
      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch configuration
      refetchOnWindowFocus: false, // Don't refetch on window focus by default
      refetchOnReconnect: 'always', // Always refetch on reconnect
      refetchOnMount: true, // Refetch on component mount if data is stale
      
      // Network mode
      networkMode: 'online', // Only fetch when online
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
      retryDelay: 1000,
      
      // Network mode
      networkMode: 'online',
      
      // Error handling
      onError: (error) => {
        logger.error('Mutation error:', error);
      },
    },
  },
  // Query client configuration
  queryCache: {
    onError: (error, query) => {
      // Global error handler for queries
      logger.error('Query error:', {
        queryKey: query.queryKey,
        error: error instanceof Error ? error.message : error,
      });
    },
    onSuccess: (data, query) => {
      // Log successful queries in development
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Query success:', {
          queryKey: query.queryKey,
        });
      }
    },
  },
  mutationCache: {
    onError: (error, variables, context, mutation) => {
      // Global error handler for mutations
      logger.error('Mutation cache error:', {
        mutationKey: mutation.options.mutationKey,
        error: error instanceof Error ? error.message : error,
      });
    },
    onSuccess: (data, variables, context, mutation) => {
      // Log successful mutations in development
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Mutation success:', {
          mutationKey: mutation.options.mutationKey,
        });
      }
    },
  },
});

// Prefetch helper
export async function prefetchQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
  staleTime?: number
) {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: staleTime || 5 * 60 * 1000, // Default 5 minutes
  });
}

// Invalidate queries helper
export function invalidateQueries(queryKey: unknown[]) {
  return queryClient.invalidateQueries({ queryKey });
}

// Set query data helper
export function setQueryData<T>(queryKey: unknown[], data: T) {
  queryClient.setQueryData(queryKey, data);
}

// Get query data helper
export function getQueryData<T>(queryKey: unknown[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}