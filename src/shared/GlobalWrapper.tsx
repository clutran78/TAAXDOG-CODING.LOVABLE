'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { logout } from './signOut';
import { Inter } from 'next/font/google';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

interface GlobalWrapperProps {
  children: React.ReactNode;
}

const GlobalWrapper: React.FC<GlobalWrapperProps> = ({ children }) => {
  const { data: session, status } = useSession();

  useEffect(() => {
    // If session is explicitly null (not loading), user is not authenticated
    if (status === 'unauthenticated') {
      // Don't auto-logout on unauthenticated - let the middleware handle redirects
      // This prevents logout loops
    }
  }, [status]);

  return <div className={`${inter.variable} antialiased`}>{children}</div>;
};

export default GlobalWrapper;
