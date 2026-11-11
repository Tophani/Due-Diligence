import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext.js';
import { api } from '../lib/api.js';

/** Who is signed in (from the server's session cookie). */
export default function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    let live = true;
    api('/auth/me')
      .then((d) => live && setState({ status: 'ready', user: d.user }))
      .catch(() => live && setState({ status: 'ready', user: null }));
    // Any request answered "please sign in" (session expired): show sign-in.
    const ended = () => setState({ status: 'ready', user: null });
    window.addEventListener('tractrac:signed-out', ended);
    return () => {
      live = false;
      window.removeEventListener('tractrac:signed-out', ended);
    };
  }, []);

  const signedIn = useCallback((user) => setState({ status: 'ready', user }), []);
  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setState({ status: 'ready', user: null });
    }
  }, []);

  const value = useMemo(() => ({ ...state, signedIn, signOut }), [state, signedIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
