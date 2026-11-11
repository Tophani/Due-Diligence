import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/adminContext.js';
import { useAuth } from '../../context/authContext.js';
import { api } from '../../lib/api.js';
import { adminRoutes } from '../../lib/routes.js';

const ROLES = [
  ['reviewer', 'Reviewer'],
  ['admin', 'Full access'],
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const row = 'flex flex-wrap gap-x-3.5 gap-y-1.5 items-center py-3 border-t border-sand-line';

function Card({ title, action, children }) {
  return (
    <section className="vs-card px-6 py-[22px] flex flex-col gap-1.5">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <h2 className="text-17 font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** GET a list; returns [state, reload]. */
function useList(path) {
  const [state, setState] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    api(path)
      .then((data) => live && setState({ status: 'ready', data }))
      .catch((err) => live && setState({ status: 'error', message: err.message }));
    return () => {
      live = false;
    };
  }, [path, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return [state, reload];
}

/** A small inline form: fields side by side, then the action and Cancel. */
function InlineForm({ fields, values, onChange, onSave, onCancel, saveLabel, canSave, busy, error }) {
  const uid = useId();
  return (
    <div className="border border-sand rounded-control p-4 my-2 flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {fields.map(([key, text, type, options]) => (
          <div key={key}>
            <label className="block text-14 font-medium mb-1" htmlFor={`${uid}-${key}`}>
              {text}
            </label>
            {options ? (
              <select id={`${uid}-${key}`} className="vs-select w-full" value={values[key]} onChange={(e) => onChange(key, e.target.value)}>
                {options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <input id={`${uid}-${key}`} type={type || 'text'} className="vs-select w-full" value={values[key]} onChange={(e) => onChange(key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-14 text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="vs-btn vs-btn-sm vs-btn-primary" disabled={!canSave || busy} onClick={onSave}>
          {busy ? 'Saving…' : saveLabel}
        </button>
        <button type="button" className="vs-btn vs-btn-sm vs-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** `/admin/setup` — due-diligence-final/admin/AdminSimpleSetup. Full access can add; Reviewers read only. */
export default function AdminSimpleSetup() {
  const { user } = useAuth();
  const full = user?.role === 'admin';
  return (
    <main className="max-w-[900px] mx-auto px-4 pt-7 pb-16 flex flex-col gap-4">
      <h1 className="text-22 font-semibold">Setup</h1>
      {!full && <p className="vs-card px-6 py-4 text-14">You have Reviewer access, so this page is read only. Ask someone with Full access to add organisations or staff.</p>}
      <Organisations full={full} />
      <Staff full={full} />
    </main>
  );
}

function Organisations({ full }) {
  const { showToast } = useAdmin();
  const [list, reload] = useList('/admin/organisations');
  const [form, setForm] = useState(null); // { name, contactName, contactEmail }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState({}); // id -> true (this visit)

  const addOrganisation = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api('/admin/organisations', { method: 'POST', body: form });
      setJustAdded((j) => ({ ...j, [data.organisation.id]: true }));
      showToast(data.invitationSent ? `${form.name} added · invitation sent to ${form.contactEmail}` : `${form.name} added, but the invitation email couldn’t be sent. They can still sign in with ${form.contactEmail}.`);
      setForm(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const stateOf = (o) => (justAdded[o.id] ? 'Invitation sent just now' : o.active ? 'Active' : 'Invited, not signed in yet');

  return (
    <Card
      title="Organisations"
      action={
        full &&
        !form && (
          <button type="button" className="vs-btn vs-btn-sm vs-btn-primary" onClick={() => setForm({ name: '', contactName: '', contactEmail: '' })}>
            + Add organisation
          </button>
        )
      }
    >
      <p className="text-14 text-stone">The contact gets an email invitation and signs in with a code.</p>
      {form && (
        <InlineForm
          fields={[
            ['name', 'Organisation name'],
            ['contactName', 'Contact name'],
            ['contactEmail', 'Contact email', 'email'],
          ]}
          values={form}
          onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
          onSave={addOrganisation}
          onCancel={() => setForm(null)}
          saveLabel="Add and send invitation"
          canSave={form.name.trim() && form.contactName.trim() && EMAIL.test(form.contactEmail.trim())}
          busy={busy}
          error={error}
        />
      )}
      {list.status === 'loading' && <p className="text-14 text-stone">Loading…</p>}
      {list.status === 'error' && <p className="text-14 text-error">{list.message}</p>}
      {list.status === 'ready' && !list.data.organisations.length && (
        <p className="text-14 text-stone py-3 border-t border-sand-line">No organisations yet.{full ? ' Use “+ Add organisation” to invite the first one.' : ''}</p>
      )}
      {list.status === 'ready' &&
        list.data.organisations.map((o) => {
          const state = stateOf(o);
          return (
            <div key={o.id} className={row}>
              <Link to={adminRoutes.organisation(o.id)} className="flex-[1_1_240px] font-medium no-underline hover:underline">
                {o.name}
              </Link>
              <span className="text-14 text-stone">{o.contactName || o.contactEmail || '—'}</span>
              <span className={`text-13 ${state === 'Active' ? '' : 'text-stone'}`}>{state}</span>
            </div>
          );
        })}
    </Card>
  );
}

function Staff({ full }) {
  const { showToast } = useAdmin();
  const { user } = useAuth();
  const [list, reload] = useList('/admin/staff');
  const [form, setForm] = useState(null); // { name, email, role }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changeRole = async (m, role) => {
    try {
      await api(`/admin/staff/${m.id}`, { method: 'PUT', body: { role } });
      showToast(`${m.name} now has ${role === 'admin' ? 'Full access' : 'Reviewer access'}`);
    } catch (err) {
      showToast(err.message);
    }
    reload();
  };
  const invite = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api('/admin/staff', { method: 'POST', body: form });
      showToast(data.invitationSent ? `Invitation sent to ${form.email}` : `${form.name} added, but the invitation email couldn’t be sent. They can still sign in with ${form.email}.`);
      setForm(null);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="TracTrac staff"
      action={
        full &&
        !form && (
          <button type="button" className="vs-btn vs-btn-sm vs-btn-outline" onClick={() => setForm({ name: '', email: '', role: 'reviewer' })}>
            + Invite staff
          </button>
        )
      }
    >
      {form && (
        <InlineForm
          fields={[
            ['name', 'Name'],
            ['email', 'Email', 'email'],
            ['role', 'Role', null, ROLES],
          ]}
          values={form}
          onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
          onSave={invite}
          onCancel={() => setForm(null)}
          saveLabel="Send invitation"
          canSave={form.name.trim() && EMAIL.test(form.email.trim())}
          busy={busy}
          error={error}
        />
      )}
      {list.status === 'loading' && <p className="text-14 text-stone">Loading…</p>}
      {list.status === 'error' && <p className="text-14 text-error">{list.message}</p>}
      {list.status === 'ready' &&
        list.data.staff.map((m) => (
          <div key={m.id} className={row}>
            <span className="flex-1 min-w-[220px]">
              <span className="font-medium">{m.name}</span> <span className="text-14 text-stone">· {m.email}</span>
              {m.id === user?.id && <span className="text-13 text-stone"> · you</span>}
            </span>
            <select
              className="vs-select !min-h-[34px] !py-1 w-40"
              aria-label={`Role for ${m.name}`}
              value={m.role}
              disabled={!full}
              onChange={(e) => changeRole(m, e.target.value)}
            >
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        ))}
      <p className="text-14 text-stone pt-1.5">Reviewers can download, upload and mark files as reviewed. Full access can also add organisations and staff.</p>
    </Card>
  );
}
