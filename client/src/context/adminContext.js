import { createContext, useContext } from 'react';

export const AdminContext = createContext(null);

/** { showToast(message) } for the admin pages — inside the admin layout. */
export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside the admin layout');
  return ctx;
}
