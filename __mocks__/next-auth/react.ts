export const useSession = jest.fn(() => ({
  data: {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
    },
    expires: '2024-12-31',
  },
  status: 'authenticated',
}));

export const signIn = jest.fn(() => Promise.resolve({ ok: true }));
export const signOut = jest.fn(() => Promise.resolve());

export const SessionProvider = ({ children }: { children: React.ReactNode }) => children;

export default {
  useSession,
  signIn,
  signOut,
  SessionProvider,
};
