import { Navigate, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../context/authContext.js';

/**
 * Shows its children only to a signed-in user with one of `roles`. Signed-out users go to
 * sign-in (and come back here afterwards); signed-in users with another role go to their own home.
 */
export default function RequireAuth({ roles, children }) {
  const { status, user } = useAuth();
  const { pathname, search } = useLocation();
  if (status === 'loading') {
    return <p className="min-h-screen bg-sand-50 pt-16 text-center text-14 text-stone">Loading…</p>;
  }
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(pathname + search)}`} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}
