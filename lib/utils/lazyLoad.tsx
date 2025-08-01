import dynamic from 'next/dynamic';
import React from 'react';

// Consistent loading components
export const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p className="text-sm text-gray-600">Loading component...</p>
    </div>
  </div>
);

export const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading page...</p>
    </div>
  </div>
);

export const InlineLoader = () => (
  <div className="inline-flex items-center">
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
    <span className="text-sm text-gray-600">Loading...</span>
  </div>
);

// Helper function to create lazy loaded components with consistent loading states
export function lazyLoadComponent<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T } | T>,
  options?: {
    loading?: React.ComponentType;
    ssr?: boolean;
    fallback?: React.ReactNode;
  },
) {
  return dynamic(
    async () => {
      const module = await importFunc();
      return 'default' in module ? module : { default: module };
    },
    {
      ssr: options?.ssr ?? true,
      loading: () => <ComponentLoader />,
    },
  );
}

// Helper for page-level lazy loading
export function lazyLoadPage<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T } | T>,
  options?: {
    ssr?: boolean;
  },
) {
  return lazyLoadComponent(importFunc, {
    loading: PageLoader,
    ssr: options?.ssr ?? true,
  });
}

// Helper for modal/dialog lazy loading
export function lazyLoadModal<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T } | T>,
) {
  return lazyLoadComponent(importFunc, {
    loading: () => null, // No loading state for modals
    ssr: false,
  });
}
