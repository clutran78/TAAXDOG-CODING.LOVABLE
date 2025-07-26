import dynamic from 'next/dynamic';
import { ComponentType, ReactElement } from 'react';
import { getDynamicImportConfig } from '../config/bundle-optimization';

/**
 * Loading component with skeleton loader
 */
const DefaultLoader = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

/**
 * Error boundary for dynamic imports
 */
const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="p-4 border border-red-300 rounded-md bg-red-50">
    <h3 className="text-red-800 font-semibold">Failed to load component</h3>
    <p className="text-red-600 text-sm mt-1">{error.message}</p>
  </div>
);

/**
 * Enhanced dynamic import with automatic configuration
 */
export function lazyImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>,
  componentName: string,
  customLoader?: ReactElement
): ComponentType<T extends ComponentType<infer P> ? P : any> {
  const config = getDynamicImportConfig(componentName);
  
  return dynamic(
    async () => {
      try {
        const module = await importFn();
        return 'default' in module ? module : { default: module };
      } catch (error) {
        console.error(`Failed to load component: ${componentName}`, error);
        throw error;
      }
    },
    {
      ...config,
      loading: customLoader ? () => customLoader : () => <DefaultLoader />,
    }
  ) as ComponentType<T extends ComponentType<infer P> ? P : any>;
}

/**
 * Lazy import with retry logic
 */
export function lazyImportWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>,
  componentName: string,
  retries = 3
): ComponentType<T extends ComponentType<infer P> ? P : any> {
  return lazyImport(
    async () => {
      let lastError: Error | null = null;
      
      for (let i = 0; i < retries; i++) {
        try {
          return await importFn();
        } catch (error) {
          lastError = error as Error;
          if (i < retries - 1) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
          }
        }
      }
      
      throw lastError || new Error(`Failed to load ${componentName} after ${retries} attempts`);
    },
    componentName
  );
}

/**
 * Preload a dynamically imported component
 */
export async function preloadComponent(
  importFn: () => Promise<any>,
  componentName: string
): Promise<void> {
  try {
    await importFn();
    console.log(`Preloaded component: ${componentName}`);
  } catch (error) {
    console.error(`Failed to preload component: ${componentName}`, error);
  }
}

/**
 * Create a lazy loaded page component
 */
export function createLazyPage<T extends ComponentType<any>>(
  importPath: string,
  componentName: string
): ComponentType<T extends ComponentType<infer P> ? P : any> {
  return lazyImport(
    () => import(importPath),
    componentName,
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading {componentName}...</p>
      </div>
    </div>
  );
}