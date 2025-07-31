export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Re-export formatCurrency from the main utils
export { formatCurrency } from './index';
