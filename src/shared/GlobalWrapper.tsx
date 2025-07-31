'use client';

import React, { useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        await logout();
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</div>
  );
};

export default GlobalWrapper;
