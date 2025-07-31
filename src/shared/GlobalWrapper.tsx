'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { logout } from './signOut';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
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
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</div>
  );
};

export default GlobalWrapper;
