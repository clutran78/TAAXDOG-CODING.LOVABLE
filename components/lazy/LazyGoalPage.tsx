/**
 * Lazy loaded version of the Goal Page
 * This reduces the initial bundle size by ~50KB
 */

import { lazyImportWithRetry } from '@/lib/utils/dynamic-import';

// Lazy load the Goal Page component
export const LazyGoalPage = lazyImportWithRetry(
  () => import('../Goal/GoalPageWithQuery'),
  'GoalPageWithQuery'
);

// Lazy load other heavy goal components
export const LazyAddGoalForm = lazyImportWithRetry(
  () => import('../Goal/AddGoalForm'),
  'AddGoalForm'
);

export const LazyGoalDashboardCard = lazyImportWithRetry(
  () => import('../Goal/GoalDashboardCard'),
  'GoalDashboardCard'
);

// Preload function for critical goal components
export async function preloadGoalComponents() {
  const { preloadComponent } = await import('@/lib/utils/dynamic-import');
  
  await Promise.all([
    preloadComponent(() => import('../Goal/GoalPageWithQuery'), 'GoalPageWithQuery'),
    preloadComponent(() => import('../Goal/AddGoalForm'), 'AddGoalForm'),
  ]);
}