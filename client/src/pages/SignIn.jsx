import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/vendor/SimpleShell.jsx';
import { homeFor, isStaff, useAuth } from '../context/authContext.js';
import { api } from '../lib/api.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only follow ?next= to a page of our own, and one this kind of user can open. */
function safeNext(next, user) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/signin') || next.startsWith('/register')) return null;
  const adminPage = next === '/admin' || next.startsWith('/admin/');
  return adminPage === isStaff(user) ? next : null;
}

function Field({ id, label, ...input }) {
  return (
    <div>
      <label htmlFor={id} className="block text-14 font-medium">
        {label}
      </label>
      <input id={id} className="vs-line" {...input} />
    </div>
  );
}

/**
 * `/signin` and `/register` (due-diligence-final/vendor/VendorSimpleSignIn): email → 6-digit code,
 * or register a new organisation → code. Vendors go to their form, staff to admin.
 */
export default function SignIn() {
  const { status, user, signedIn } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(pathname === '/register' ? 'register' : 'email'); // email | code | register
  const [sentFrom, setSentFrom] = useState('email'); // which form asked for the code ("Send again")
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  if (status === 'ready' && user && !busy) return <Navigate to={homeFor(user)} replace />;

  const switchTo = (next) => {
    setMode(next);
    setError('');
    setNote('');
    navigate(next === 'register' ? '/register' : '/signin', { replace: true });
  };

  /** Request a code (registering first if asked). The server answers the same either way. */
  const send = async (e, again = false) => {
    e?.preventDefault();
    setError('');
    setNote('');
    const registering = again ? sentFrom === 'register' : mode === 'register';
    if (!EMAIL.test(email.trim())) return setError('Enter your work email, like name@example.com.');
    if (registering && (!name.trim() || !organisationName.trim())) return setError('Enter your name and your organisation’s name.');
    setBusy(true);
    try {
      if (registering) await api('/auth/register', { method: 'POST', body: { name: name.trim(), email: email.trim(), organisationName: organisationName.trim() } });
      else await api('/auth/request-code', { method: 'POST', body: { email: email.trim() } });
      if (again) setNote('We’ve sent a new code. Use the newest one.');
      setSentFrom(registering ? 'register' : 'email');
      setMode('code');
      setCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError('');
    setNote('');
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) return setError('Enter the 6-digit code from the email.');
    setBusy(true);
    try {
      const { user: me } = await api('/auth/verify-code', { method: 'POST', body: { email: email.trim(), code: digits } });
      signedIn(me);
      navigate(safeNext(params.get('next'), me) || homeFor(me), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const errorText = error && (
    <p id="signin-error" role="alert" className="text-14 text-error">
      {error}
    </p>
  );
  const described = error ? { 'aria-invalid': true, 'aria-describedby': 'signin-error' } : {};

  return (
    <div className="min-h-screen bg-sand-50 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-[440px]">
        {/* Everything sits in one box: logo and name, the form, then the privacy note. */}
        <section className="vs-card vs-card-top">
          <div className="px-7 pt-6 pb-5 border-b border-sand-line">
            <Brand company />
          </div>
          <div className="p-7">
          {mode === 'email' && (
            <form onSubmit={send} className="flex flex-col gap-[18px]" noValidate>
              <div>
                <h1 className="text-22 font-semibold">Sign in</h1>
                <p className="text-14 text-stone mt-1">For TracTrac vendors, partners and staff. We&apos;ll email you a code, so there&apos;s no password to remember.</p>
              </div>
              <Field id="email" label="Work email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} {...described} />
              {errorText}
              <button type="submit" className="vs-btn vs-btn-lg vs-btn-primary w-full" disabled={busy}>
                {busy ? 'Sending…' : 'Email me a sign-in code'}
              </button>
              <p className="text-14 text-stone">
                New organisation?{' '}
                <button type="button" className="vs-link" onClick={() => switchTo('register')}>
                  Register here
                </button>
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={send} className="flex flex-col gap-[18px]" noValidate>
              <div>
                <h1 className="text-22 font-semibold">Register your organisation</h1>
                <p className="text-14 text-stone mt-1">Just the basics. The form asks for everything else.</p>
              </div>
              <Field id="reg-name" label="Your name" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
              <Field id="reg-email" label="Work email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field id="reg-org" label="Organisation name" autoComplete="organization" value={organisationName} onChange={(e) => setOrganisationName(e.target.value)} />
              {errorText}
              <button type="submit" className="vs-btn vs-btn-lg vs-btn-primary w-full" disabled={busy}>
                {busy ? 'Sending…' : 'Continue'}
              </button>
              <p className="text-14 text-stone">
                Already registered?{' '}
                <button type="button" className="vs-link" onClick={() => switchTo('email')}>
                  Sign in
                </button>
              </p>
            </form>
          )}

          {mode === 'code' && (
            <form onSubmit={verify} className="flex flex-col gap-[18px]" noValidate>
              <div>
                <h1 className="text-22 font-semibold">Check your email</h1>
                <p className="text-14 text-stone mt-1">
                  We sent a 6-digit code to <span className="text-ink font-medium">{email.trim()}</span>. It works for 10 minutes.
                </p>
              </div>
              <div>
                <label htmlFor="code" className="block text-14 font-medium">
                  Code
                </label>
                <input
                  id="code"
                  className="vs-line font-mono !text-22 tracking-[0.3em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  {...described}
                />
              </div>
              {errorText}
              {note && (
                <p role="status" className="text-14">
                  {note}
                </p>
              )}
              <button type="submit" className="vs-btn vs-btn-lg vs-btn-primary w-full" disabled={busy}>
                {busy ? 'Checking…' : 'Sign in'}
              </button>
              <p className="text-14 text-stone">
                Didn&apos;t get it?{' '}
                <button type="button" className="vs-link" onClick={(e) => send(e, true)} disabled={busy}>
                  Send again
                </button>{' '}
                ·{' '}
                <button type="button" className="vs-link" onClick={() => switchTo('email')}>
                  Use another email
                </button>
              </p>
            </form>
          )}
          </div>
          <p className="px-7 py-4 border-t border-sand-line text-13 text-stone text-center">Your documents are only visible to your organisation and TracTrac staff.</p>
        </section>
      </div>
    </div>
  );
}
