import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

/** { status: 'loading' | 'ready', user, signedIn(user), signOut() } — inside <AuthProvider>. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Where a user lands after signing in: vendors on their form, TracTrac staff on admin. */
export const homeFor = (user) => (user?.role === 'vendor' ? '/' : '/admin');
export const isStaff = (user) => user?.role === 'reviewer' || user?.role === 'admin';
