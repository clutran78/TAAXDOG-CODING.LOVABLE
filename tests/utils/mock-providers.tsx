import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';

// Create a new QueryClient for each test to ensure isolation
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Mock providers wrapper
interface TestProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function TestProviders({ children, queryClient }: TestProvidersProps) {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Mock environment variables
export function mockEnvironmentVariables(overrides: Record<string, string> = {}) {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-secret',
      DATABASE_URL: 'postgresql://test@localhost/test',
      ...overrides,
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });
}
