import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/authContext.js';
import logo from '../../assets/tractrac-logo.png';
import { COMPANY_NAME, PRODUCT_NAME } from '../../lib/brand.js';
import clsx from '../../lib/clsx.js';
import { vendorRoutes } from '../../lib/routes.js';

/**
 * Shared pieces of the vendor screens (due-diligence-final/vendor): one centred 680px column of
 * white cards. The main card of each page carries the logo, the product name and a short note.
 */

/**
 * The TracTrac logo with the product name beside it (and, if asked, the company line under it).
 * Used at the top of every page's main box, and in the admin header bar.
 */
export function Brand({ company = false, suffix = null }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      <img src={logo} alt="TracTrac" width="824" height="230" className="h-8 w-auto flex-none" />
      <span className="h-7 w-px bg-sand flex-none" aria-hidden="true" />
      <span className="flex flex-col leading-[1.2] min-w-0">
        <span className="font-semibold">
          {PRODUCT_NAME}
          {suffix}
        </span>
        {company && <span className="text-12 text-stone">{COMPANY_NAME}</span>}
      </span>
    </span>
  );
}

/** "{name} · Help · Sign out" */
export function UserLinks({ signOut: showSignOut = false }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const leave = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };
  return (
    <>
      {user?.name} · <a href="#">Help</a>
      {showSignOut && (
        <>
          {' '}
          ·{' '}
          <button type="button" className="vs-link !text-13" onClick={leave}>
            Sign out
          </button>
        </>
      )}
    </>
  );
}

/** "Saving…" / "All changes saved" / "Couldn't save — retry" */
export function SaveNote({ save, onRetry }) {
  return (
    <span aria-live="polite">
      {save.status === 'saving' && 'Saving…'}
      {save.status === 'saved' && 'All changes saved'}
      {save.status === 'error' && (
        <span className="text-error" title={save.message || undefined}>
          Couldn&apos;t save —{' '}
          <button type="button" className="vs-link !text-13" onClick={onRetry}>
            retry
          </button>
        </span>
      )}
    </span>
  );
}

/**
 * The page's main card: orange stripe, then the logo and product name with a short note on the
 * right (the save note, or the user's name with Help · Sign out), then the page's own content.
 */
export function HeaderCard({ note, linkHome = true, className, children }) {
  return (
    <section className="vs-card vs-card-top">
      <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 px-7 pt-5 pb-4 border-b border-sand-line">
        {linkHome ? (
          <Link to={vendorRoutes.dashboard()} className="focus-ring no-underline text-ink rounded-md" aria-label="Due Diligence Portal: back to start">
            <Brand />
          </Link>
        ) : (
          <Brand />
        )}
        {note && <span className="text-13 text-stone text-right">{note}</span>}
      </div>
      <div className={clsx('px-7 py-6 flex flex-col', className)}>{children}</div>
    </section>
  );
}

export function Card({ as: Tag = 'section', className, children, ...rest }) {
  return (
    <Tag className={clsx('vs-card', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Progress bar: orange fill on a sand track. */
export function Bar({ percent, height = 'h-2', label, ...aria }) {
  return (
    <div
      className={clsx(height, 'bg-sand rounded-full overflow-hidden')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      {...aria}
    >
      <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Muted({ as: Tag = 'p', className, children }) {
  return <Tag className={clsx('text-14 text-stone', className)}>{children}</Tag>;
}

/** Orange checkmark (checkmarks may be orange; text never is). */
export function Check({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" className="flex-none text-brand">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
