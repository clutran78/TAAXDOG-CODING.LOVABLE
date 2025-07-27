import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import { Session } from 'next-auth';

// Mock session data
export const mockSession: Session = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
  },
  expires: '2024-12-31',
};

export const mockAdminSession: Session = {
  user: {
    id: 'test-admin-id',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  },
  expires: '2024-12-31',
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  session?: Session | null;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { session = mockSession, ...renderOptions }: CustomRenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <SessionProvider session={session}>{children}</SessionProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
export { renderWithProviders as render };
