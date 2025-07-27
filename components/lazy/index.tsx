/**
 * Centralized lazy-loaded components
 * These components are loaded on-demand to improve initial page load
 */

import { lazyLoadComponent, lazyLoadModal } from '@/lib/utils/lazyLoad';

// Dashboard Components
export const LazyBudgetDashboard = lazyLoadComponent(
  () => import('@/components/budget/BudgetDashboard'),
);

export const LazyReceiptList = lazyLoadComponent(() => import('@/components/receipts/ReceiptList'));

export const LazyBankConnectionManager = lazyLoadComponent(
  () => import('@/components/banking/BankConnectionManager'),
);

// Modals (loaded without SSR)
export const LazyTransactionDetails = lazyLoadModal(
  () => import('@/components/transactions/TransactionDetails'),
);

export const LazyReceiptEditor = lazyLoadModal(() => import('@/components/receipts/ReceiptEditor'));

export const LazyCreateBudgetModal = lazyLoadModal(
  () => import('@/components/budget/CreateBudgetModal'),
);

export const LazyGoalsModal = lazyLoadModal(() => import('@/components/Goal/DashboardGoalModal'));

// Heavy visualization components
export const LazyChartComponents = lazyLoadComponent(
  () =>
    import('@/components/charts').then((mod) => ({
      default: mod.ChartComponents,
    })),
  { ssr: false }, // Charts don't need SSR
);

// AI Components
export const LazyAIAssistant = lazyLoadComponent(() => import('@/components/ai/AIAssistant'), {
  ssr: false,
});

// Tax Components
export const LazyTaxCalculator = lazyLoadComponent(() => import('@/components/tax/TaxCalculator'));

export const LazyTaxReturnForm = lazyLoadComponent(() => import('@/components/tax/TaxReturnForm'));
