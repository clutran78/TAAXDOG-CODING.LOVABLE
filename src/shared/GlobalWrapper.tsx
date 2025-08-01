'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { logout } from './signOut';
import { Inter, Roboto_Mono } from 'next/font/google';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
});

interface GlobalWrapperProps {
  children: React.ReactNode;
}

const GlobalWrapper: React.FC<GlobalWrapperProps> = ({ children }) => {
  const { data: session, status } = useSession();

  useEffect(() => {
    // If the session is loaded and there's no user, logout
    if (status === 'authenticated' && !session?.user) {
      logout();
    }
  }, [status, session]);

  return (
    <div className={`${inter.variable} ${robotoMono.variable} antialiased`}>{children}</div>
  );
};

export default GlobalWrapper;
