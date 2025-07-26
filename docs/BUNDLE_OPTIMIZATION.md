# Bundle Size Optimization Guide

## Overview

This guide covers the bundle optimization strategies implemented in the TAAXDOG application to improve performance and reduce load times.

## Current Optimizations

### 1. Code Splitting

The application uses automatic code splitting with custom chunk configurations:

```javascript
// next.config.js
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      framework: { /* React, Next.js */ },
      lib: { /* Third-party libraries */ },
      common: { /* Shared components */ },
      async: { /* Async loaded components */ }
    }
  }
}
```

### 2. Dynamic Imports

Heavy components are lazy loaded to reduce initial bundle size:

```typescript
// Example: Lazy loading the Goal Page
import { lazyImportWithRetry } from '@/lib/utils/dynamic-import';

const LazyGoalPage = lazyImportWithRetry(
  () => import('../Goal/GoalPageWithQuery'),
  'GoalPageWithQuery'
);
```

### 3. Image Optimization

Next.js Image component with modern formats:

```javascript
images: {
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
}
```

### 4. Bundle Analysis

Run bundle analysis to identify optimization opportunities:

```bash
npm run analyze-bundle
```

This generates an `analyze.html` file showing bundle composition.

### 5. Compression

- Gzip compression enabled for all assets
- Brotli compression for modern browsers
- SWC minification for smaller JavaScript

## Performance Budgets

| Bundle | Target Size | Current Size | Status |
|--------|-------------|--------------|--------|
| Main | 150KB | - | - |
| Framework | 100KB | - | - |
| Vendor | 200KB | - | - |
| Total | 500KB | - | - |

## Optimization Strategies

### 1. Component-Level Optimization

```typescript
// Use lazy loading for heavy components
const LazyInsightsDashboard = lazyImport(
  () => import('./InsightsDashboard'),
  'InsightsDashboard'
);

// Preload critical components
useEffect(() => {
  if (router.pathname === '/dashboard') {
    preloadComponent(
      () => import('./InsightsDashboard'),
      'InsightsDashboard'
    );
  }
}, [router.pathname]);
```

### 2. Library Optimization

```typescript
// Import only what you need
import debounce from 'lodash/debounce'; // ❌ Bad
import { debounce } from 'lodash-es'; // ✅ Good

// Dynamic import for heavy libraries
const loadChart = async () => {
  const { Chart } = await import('recharts');
  return Chart;
};
```

### 3. Route-Based Code Splitting

```typescript
// pages/insights.tsx
import { createLazyPage } from '@/lib/utils/dynamic-import';

// This page's code is only loaded when needed
export default createLazyPage(
  '../components/insights/InsightsDashboard',
  'InsightsDashboard'
);
```

### 4. Resource Hints

```typescript
// Prefetch critical routes
useEffect(() => {
  router.prefetch('/dashboard');
  router.prefetch('/transactions');
}, [router]);

// Preload critical resources
<link rel="preload" href="/fonts/inter.woff2" as="font" crossOrigin="" />
```

## Monitoring Bundle Size

### Build Time Analysis

```bash
# Generate build stats
npm run build -- --analyze

# Check bundle sizes
npm run build
# Look for: "Page Size" and "First Load JS" metrics
```

### Runtime Performance

Monitor these metrics in production:

1. **First Contentful Paint (FCP)**: < 1.8s
2. **Largest Contentful Paint (LCP)**: < 2.5s
3. **Time to Interactive (TTI)**: < 3.8s
4. **Total Blocking Time (TBT)**: < 200ms

## Best Practices

### 1. Dynamic Imports

```typescript
// ❌ Bad: Import everything upfront
import { HeavyComponent } from './HeavyComponent';

// ✅ Good: Dynamic import when needed
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### 2. Tree Shaking

```typescript
// ❌ Bad: Import entire library
import * as utils from '@/lib/utils';

// ✅ Good: Import specific functions
import { formatCurrency, parseDate } from '@/lib/utils';
```

### 3. Avoid Barrel Exports for Heavy Modules

```typescript
// ❌ Bad: components/index.ts
export * from './HeavyComponent1';
export * from './HeavyComponent2';

// ✅ Good: Import directly
import HeavyComponent1 from '@/components/HeavyComponent1';
```

### 4. Optimize Third-Party Scripts

```typescript
// Load non-critical scripts after page load
useEffect(() => {
  const timer = setTimeout(() => {
    // Load analytics, chat widgets, etc.
    loadThirdPartyScript();
  }, 3000);
  
  return () => clearTimeout(timer);
}, []);
```

## Troubleshooting

### Large Bundle Size

1. Run `npm run analyze-bundle` to identify large modules
2. Check for duplicate dependencies: `npm ls --depth=0`
3. Look for accidentally imported dev dependencies
4. Ensure tree shaking is working properly

### Slow Initial Load

1. Check if critical components are lazy loaded
2. Verify resource hints are in place
3. Ensure compression is enabled
4. Check for render-blocking resources

### Memory Issues

1. Look for memory leaks in components
2. Clear intervals/timeouts in useEffect cleanup
3. Avoid storing large objects in state
4. Use pagination for large lists

## Future Optimizations

1. **Module Federation**: Share code between micro-frontends
2. **Service Worker**: Cache static assets
3. **Edge Functions**: Move computation closer to users
4. **Partial Hydration**: Hydrate only interactive components
5. **Island Architecture**: Reduce JavaScript for static content

## Useful Commands

```bash
# Analyze bundle
npm run analyze-bundle

# Build with stats
npm run build -- --profile

# Check package sizes
npx bundle-phobia [package-name]

# Find duplicate packages
npx yarn-deduplicate

# Visualize dependencies
npx webpack-bundle-analyzer .next/stats.json
```