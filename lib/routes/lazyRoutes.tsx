/**
 * Lazy-loaded route configuration
 * All routes are loaded on-demand to improve initial bundle size
 *
 * NOTE: This file is currently not in use as the app uses Next.js App Router
 * Keeping for potential future use with proper path updates
 */

/*
import { lazyLoadPage } from '@/lib/utils/lazyLoad';

// Authentication Pages
export const LazyLoginPage = lazyLoadPage(() => import('@/src/app/login/page'));

export const LazyRegisterPage = lazyLoadPage(() => import('@/src/app/register/page'));

export const LazyForgotPasswordPage = lazyLoadPage(() => import('@/src/app/forgot-password/page'));

export const LazyResetPasswordPage = lazyLoadPage(() => import('@/src/app/reset-password/page'));

// Dashboard Pages
export const LazyDashboardPage = lazyLoadPage(() => import('@/pages/dashboard'));

export const LazyInsightsPage = lazyLoadPage(() => import('@/pages/insights'));

// Banking Pages
export const LazyBankingPage = lazyLoadPage(() => import('@/pages/banking'));

export const LazyBankConnectPage = lazyLoadPage(() => import('@/pages/banking/connect'));

// Transaction Pages
export const LazyTransactionsPage = lazyLoadPage(() => import('@/pages/transactions'));

// Budget Pages
export const LazyBudgetPage = lazyLoadPage(() => import('@/pages/budget'));

// Goals Pages
export const LazyGoalsPage = lazyLoadPage(() => import('@/pages/goals'));

export const LazyNewGoalPage = lazyLoadPage(() => import('@/pages/goals/new'));

// Receipt Pages
export const LazyReceiptsPage = lazyLoadPage(() => import('@/pages/receipts'));

export const LazyReceiptUploadPage = lazyLoadPage(() => import('@/pages/receipts/upload'));

// Tax Pages
export const LazyTaxReturnsPage = lazyLoadPage(() => import('@/pages/tax-returns'));

export const LazyTaxCalculatorPage = lazyLoadPage(() => import('@/pages/tax/calculator'));

// Document Pages
export const LazyDocumentsPage = lazyLoadPage(() => import('@/pages/documents'));

// Settings Pages
export const LazySettingsPage = lazyLoadPage(() => import('@/pages/settings'));

export const LazyProfileSettingsPage = lazyLoadPage(() => import('@/pages/settings/profile'));

export const LazySecuritySettingsPage = lazyLoadPage(() => import('@/pages/settings/security'));

export const LazySubscriptionPage = lazyLoadPage(() => import('@/pages/settings/Subscription'));

// Route configuration with metadata
export const routeConfig = {
  auth: {
    login: { component: LazyLoginPage, public: true },
    register: { component: LazyRegisterPage, public: true },
    'forgot-password': { component: LazyForgotPasswordPage, public: true },
    'reset-password': { component: LazyResetPasswordPage, public: true },
  },
  dashboard: {
    index: { component: LazyDashboardPage, protected: true },
    insights: { component: LazyInsightsPage, protected: true },
  },
  banking: {
    index: { component: LazyBankingPage, protected: true },
    connect: { component: LazyBankConnectPage, protected: true },
  },
  transactions: {
    index: { component: LazyTransactionsPage, protected: true },
  },
  budget: {
    index: { component: LazyBudgetPage, protected: true },
  },
  goals: {
    index: { component: LazyGoalsPage, protected: true },
    new: { component: LazyNewGoalPage, protected: true },
  },
  receipts: {
    index: { component: LazyReceiptsPage, protected: true },
    upload: { component: LazyReceiptUploadPage, protected: true },
  },
  tax: {
    returns: { component: LazyTaxReturnsPage, protected: true },
    calculator: { component: LazyTaxCalculatorPage, protected: true },
  },
  documents: {
    index: { component: LazyDocumentsPage, protected: true },
  },
  settings: {
    index: { component: LazySettingsPage, protected: true },
    profile: { component: LazyProfileSettingsPage, protected: true },
    security: { component: LazySecuritySettingsPage, protected: true },
    subscription: { component: LazySubscriptionPage, protected: true },
  },
};
*/
