import { logger } from '@/lib/logger';

// Helper functions for the application

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
};

export const showToast = (
  message: string,
  type: 'success' | 'danger' | 'warning' | 'info' = 'info',
) => {
  // This would integrate with your toast notification system
  logger.info(`[${type.toUpperCase();}] ${message}`);

  // Create a toast notification element
  if (typeof window !== 'undefined') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#10b981' : type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
};

export const loadIncomeDetails = async () => {
  try {
    const response = await fetch('/api/basiq/transactions?type=income');
    if (!response.ok) throw new Error('Failed to load income details');
    return await response.json();
  } catch (error) {
    logger.error('Error loading income details:', error);
    return [];
  }
};

export const setupFinancialFeatureHandlers = () => {
  // Set up event handlers for financial features
  if (typeof window !== 'undefined') {
    // Add any global event handlers here
    logger.info('Financial feature handlers initialized');
  }
};

export const updateBankConnectionsDisplay = (connections: any[]) => {
  // Update the display of bank connections
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('bankConnectionsUpdated', { detail: connections });
    window.dispatchEvent(event);
  }
};

// Date formatting helpers
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Calculation helpers
export const calculateProgress = (current: number, target: number): number => {
  if (target === 0) return 0;
  return Math.min((current / target) * 100, 100);
};

// Validation helpers
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidABN = (abn: string): boolean => {
  // Basic ABN validation (11 digits)
  const cleanABN = abn.replace(/\s/g, '');
  return /^\d{11}$/.test(cleanABN);
};
