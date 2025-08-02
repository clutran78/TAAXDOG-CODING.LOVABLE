import { signOut } from 'next-auth/react';

export const logout = async () => {
  await signOut({
    redirect: true,
    callbackUrl: '/login',
  });
};
