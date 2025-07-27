import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import Head from 'next/head';

export default function LogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: '/auth/login' });
  }, []);

  return (
    <>
      <Head>
        <title>Logging out...</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Logging out...</p>
        </div>
      </div>
    </>
  );
}
