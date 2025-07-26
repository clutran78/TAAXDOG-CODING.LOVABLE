import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchGoals, createGoal, updateGoal, deleteGoal } from '@/lib/services/goals/client-goal-service';
import { showToast } from '@/lib/utils/helpers';
import { Goal } from '@/lib/types/goal';

// Query keys
export const goalKeys = {
  all: ['goals'] as const,
  lists: () => [...goalKeys.all, 'list'] as const,
  list: (filters?: { status?: string; category?: string }) => 
    [...goalKeys.lists(), filters] as const,
  detail: (id: string) => [...goalKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch all goals
 */
export function useGoals(filters?: { status?: string; category?: string }) {
  return useQuery({
    queryKey: goalKeys.list(filters),
    queryFn: () => fetchGoals(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single goal
 */
export function useGoal(id: string) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn: () => fetchGoals().then(goals => goals.find(g => g.id === id)),
    enabled: !!id,
  });
}

/**
 * Hook to create a new goal
 */
export function useCreateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createGoal,
    onSuccess: (data) => {
      // Invalidate and refetch goals list
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
      showToast('Goal created successfully!', 'success');
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : 'Failed to create goal',
        'danger'
      );
    },
  });
}

/**
 * Hook to update a goal
 */
export function useUpdateGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Goal> }) => 
      updateGoal(id, data),
    onSuccess: (data, variables) => {
      // Update the specific goal in cache
      queryClient.setQueryData(goalKeys.detail(variables.id), data);
      
      // Invalidate goals list to refetch
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
      
      showToast('Goal updated successfully!', 'success');
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : 'Failed to update goal',
        'danger'
      );
    },
  });
}

/**
 * Hook to delete a goal
 */
export function useDeleteGoal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: (_, goalId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: goalKeys.detail(goalId) });
      
      // Invalidate goals list
      queryClient.invalidateQueries({ queryKey: goalKeys.lists() });
      
      showToast('Goal deleted successfully!', 'success');
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : 'Failed to delete goal',
        'danger'
      );
    },
  });
}

/**
 * Hook to prefetch goals
 */
export function usePrefetchGoals() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.prefetchQuery({
      queryKey: goalKeys.list(),
      queryFn: fetchGoals,
      staleTime: 5 * 60 * 1000,
    });
  };
}