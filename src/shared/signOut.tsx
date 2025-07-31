import Cookies from 'js-cookie';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export const logout = async () => {
  debugger;
  await signOut(auth);
  Cookies.remove('auth-token');
  window.location.href = '/login';
};
