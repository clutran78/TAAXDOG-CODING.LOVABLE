'use client';
import React, { useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logout } from './signOut';

interface GlobalWrapperProps {
  children: React.ReactNode;
}

const GlobalWrapper: React.FC<GlobalWrapperProps> = ({ children }) => {
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        // Trigger logout and redirect
        await logout();
      }
    });

    return () => unsubscribe();
  }, []);

  return <>{children}</>
};

export default GlobalWrapper;
