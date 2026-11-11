import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Toast } from '../components/ui';
import { Brand } from '../components/vendor/SimpleShell.jsx';
import { AdminContext } from '../context/adminContext.js';
import { useAuth } from '../context/authContext.js';
import clsx from '../lib/clsx.js';
import { adminRoutes } from '../lib/routes.js';

const TOAST_MS = 2800;

// The three links in the top bar, and which one a path belongs to.
const LINKS = [
  ['home', 'Home', adminRoutes.dashboard()],
  ['organisations', 'Organisations', '/admin/organisations'],
  ['setup', 'Setup', adminRoutes.setup()],
];
function activeKey(pathname) {
  if (pathname.startsWith('/admin/organisations')) return 'organisations';
  if (pathname.startsWith('/admin/setup')) return 'setup';
  return 'home';
}

/** Top bar (due-diligence-final/admin): logo, Home · Organisations · Setup (current one underlined in orange), name · Sign out. */
function AdminTopBar() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const active = activeKey(pathname);
  const leave = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };
  return (
    <header className="bg-white border-b border-sand px-6 min-h-[60px] flex flex-wrap gap-x-7 gap-y-2 items-center">
      <Brand suffix={<span className="text-stone font-normal"> · Admin</span>} />
      <nav aria-label="Admin" className="flex flex-1 gap-1 text-14 self-stretch">
        {LINKS.map(([key, label, to]) => (
          <Link
            key={key}
            to={to}
            aria-current={key === active ? 'page' : undefined}
            className={clsx(
              'focus-ring flex items-center px-3 no-underline border-b-[3px]',
              key === active ? 'border-brand text-ink font-semibold' : 'border-transparent text-stone hover:text-ink',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <span className="text-13 text-stone">
        {user?.name} ·{' '}
        <button type="button" className="vs-link !text-13" onClick={leave}>
          Sign out
        </button>
      </span>
    </header>
  );
}

/** Every /admin page: the top bar, the page, and a toast for short confirmations. */
export default function AdminLayout() {
  const [toast, setToast] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const showToast = useCallback((message) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(''), TOAST_MS);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return (
    <AdminContext.Provider value={value}>
      <div className="min-h-screen bg-sand-50 text-15">
        <AdminTopBar />
        <Outlet />
        <Toast message={toast} />
      </div>
    </AdminContext.Provider>
  );
}
