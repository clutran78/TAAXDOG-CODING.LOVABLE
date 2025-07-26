/**
 * Bundle optimization configuration and utilities
 */

export const bundleOptimizationConfig = {
  // Code splitting boundaries (in bytes)
  splitChunks: {
    minSize: 20000, // 20KB minimum chunk size
    maxSize: 244000, // 244KB maximum chunk size
    minChunks: 2, // Minimum number of chunks that must share a module
  },

  // Lazy loading patterns
  lazyLoadPatterns: {
    // Components that should be lazy loaded
    components: [
      'GoalPageWithQuery',
      'InsightsDashboard',
      'FinancialInsights',
      'DataDashboard',
      'BudgetDashboard',
      'ReceiptProcessor',
      'TaxProfile',
    ],
    
    // Routes that should be prefetched
    prefetchRoutes: [
      '/dashboard',
      '/transactions',
      '/goals',
    ],
    
    // Heavy libraries that should be dynamically imported
    libraries: [
      'recharts',
      'd3',
      '@mui/material',
      'react-pdf',
      'xlsx',
    ],
  },

  // Performance budgets
  performanceBudgets: {
    // Maximum sizes in KB
    bundles: {
      main: 150,
      framework: 100,
      vendor: 200,
      total: 500,
    },
    
    // Loading time targets in ms
    metrics: {
      fcp: 1800, // First Contentful Paint
      lcp: 2500, // Largest Contentful Paint
      tti: 3800, // Time to Interactive
      tbt: 200,  // Total Blocking Time
    },
  },

  // Optimization strategies
  strategies: {
    // Use dynamic imports for heavy components
    dynamicImports: true,
    
    // Enable tree shaking
    treeShaking: true,
    
    // Remove unused CSS
    purgeCss: true,
    
    // Optimize images
    optimizeImages: true,
    
    // Enable compression
    compression: {
      gzip: true,
      brotli: true,
    },
    
    // Preload critical resources
    preload: {
      fonts: true,
      criticalCss: true,
    },
  },
};

/**
 * Get dynamic import configuration for a component
 */
export function getDynamicImportConfig(componentName: string) {
  const isHeavyComponent = bundleOptimizationConfig.lazyLoadPatterns.components.includes(componentName);
  
  return {
    ssr: !isHeavyComponent, // Disable SSR for heavy components
    loading: () => null, // Or provide a loading component
    suspense: true,
  };
}

/**
 * Check if a route should be prefetched
 */
export function shouldPrefetchRoute(route: string): boolean {
  return bundleOptimizationConfig.lazyLoadPatterns.prefetchRoutes.some(
    pattern => route.startsWith(pattern)
  );
}

/**
 * Get chunk name for dynamic imports
 */
export function getChunkName(modulePath: string): string {
  if (modulePath.includes('components/insights')) return 'insights';
  if (modulePath.includes('components/receipts')) return 'receipts';
  if (modulePath.includes('components/tax')) return 'tax';
  if (modulePath.includes('components/budget')) return 'budget';
  if (modulePath.includes('components/Goal')) return 'goals';
  if (modulePath.includes('node_modules')) {
    if (modulePath.includes('recharts')) return 'charts';
    if (modulePath.includes('@mui')) return 'ui';
    if (modulePath.includes('react-query')) return 'query';
  }
  return 'default';
}