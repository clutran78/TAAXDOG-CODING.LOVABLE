import Cookies from 'js-cookie';
import { signOut } from 'next-auth/react';

export const logout = async () => {
  // Sign out from NextAuth
  await signOut({ redirect: false });

  // Clear any additional cookies
  Cookies.remove('auth-token');

  // Redirect to login page
  window.location.href = '/login';
};
