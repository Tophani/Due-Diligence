import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/adminContext.js';
import { api } from '../../lib/api.js';
import { buildWorkbook, download, XLSX_TYPE } from '../../lib/exportXlsx.js';
import { formatDay, formatShortDay, plural, todayIso } from '../../lib/format.js';
import { adminRoutes } from '../../lib/routes.js';

/**
 * Vendor progress in plain words: Submitted · In progress · No documents yet · Not started.
 * "No documents yet" once the first-submission date has passed with nothing uploaded.
 */
function vendorState(o, cycle, today) {
  if (o.submittedAt) return { key: 'submitted', text: 'Submitted' };
  if (o.filesUploaded > 0 || o.progress > 0) return { key: 'progress', text: 'In progress' };
  if (cycle.firstSubmissionOn && today > cycle.firstSubmissionOn) return { key: 'none', text: 'No documents yet' };
  return { key: 'not_started', text: 'Not started' };
}

/** The four numbers; each one filters the table. */
const TILES = [
  { key: 'none', label: 'No documents yet', sub: () => 'Send them a reminder', test: (s) => s.key === 'none' || s.key === 'not_started' },
  { key: 'progress', label: 'In progress', sub: () => 'Filling in the form', test: (s) => s.key === 'progress' },
  { key: 'submitted', label: 'Submitted', sub: () => 'Form complete', test: (s) => s.key === 'submitted' },
  { key: 'review', label: 'Not yet reviewed', sub: (orgs) => `${plural(orgs.reduce((n, o) => n + o.notReviewed, 0), 'file')} to check`, test: (s, o) => o.notReviewed > 0 },
];

/** `/admin` (and `/admin/organisations`) — due-diligence-final/admin/AdminSimpleHome. */
export default function AdminSimpleHome() {
  const { showToast } = useAdmin();
  const [load, setLoad] = useState({ status: 'loading' });
  const [filter, setFilter] = useState(null);
  const [q, setQ] = useState('');
  const [reminded, setReminded] = useState({});

  useEffect(() => {
    let live = true;
    api('/admin/overview')
      .then((data) => live && setLoad({ status: 'ready', ...data }))
      .catch((err) => live && setLoad({ status: 'error', message: err.message }));
    return () => {
      live = false;
    };
  }, []);

  if (load.status === 'loading') return <p className="text-center text-14 text-stone pt-10">Loading…</p>;
  if (load.status === 'error') return <p className="text-center text-14 text-error pt-10">{load.message}</p>;
  if (!load.cycle) {
    return (
      <main className="max-w-[1100px] mx-auto px-4 pt-7">
        <section className="vs-card vs-card-top px-6 py-[22px] flex flex-col gap-1">
          <h1 className="text-22 font-semibold">No cycle is open</h1>
          <p className="text-14 text-stone">
            There&apos;s no due diligence cycle open today. Organisations appear here once a cycle has opened (its dates are set when the database is
            prepared; see DEPLOY.md).
          </p>
        </section>
      </main>
    );
  }

  const today = todayIso();
  const orgs = load.organisations.map((o) => ({ ...o, state: vendorState(o, load.cycle, today) }));
  const tile = TILES.find((t) => t.key === filter);
  const query = q.trim().toLowerCase();
  const rows = orgs.filter((o) => (tile ? tile.test(o.state, o) : true) && (!query || o.name.toLowerCase().includes(query)));

  const remind = async (o) => {
    try {
      const { message } = await api(`/admin/organisations/${o.id}/reminder`, { method: 'POST' });
      setReminded((r) => ({ ...r, [o.id]: true }));
      showToast(message);
    } catch (err) {
      showToast(err.message);
    }
  };

  /** The one Excel export: every organisation and its counts, on one sheet. */
  const downloadExcel = async () => {
    try {
      const sheet = {
        name: 'Organisations',
        columns: [
          { header: 'Organisation', width: 40 },
          { header: 'Status', width: 18 },
          { header: 'Progress', width: 11, format: 'pct' },
          { header: 'Files uploaded', width: 15, format: 'int' },
          { header: 'Not yet reviewed', width: 17, format: 'int' },
          { header: 'Last upload', width: 14 },
          { header: 'Submitted', width: 14 },
          { header: 'Contact', width: 24 },
          { header: 'Contact email', width: 34 },
        ],
        rows: orgs.map((o) => [
          o.name,
          o.state.text,
          o.progress / 100,
          o.filesUploaded,
          o.notReviewed,
          o.lastUploadAt ? formatDay(o.lastUploadAt.slice(0, 10)) : '',
          o.submittedAt ? formatDay(o.submittedAt.slice(0, 10)) : '',
          o.contactName || '',
          o.contactEmail || '',
        ]),
      };
      const name = `Due_Diligence_Portal_${load.cycle.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${today}.xlsx`;
      download(await buildWorkbook([sheet]), name, XLSX_TYPE);
      showToast(`${name} downloaded`);
    } catch (err) {
      showToast(`Couldn’t create the file: ${err.message}`);
    }
  };

  return (
    <main className="max-w-[1100px] mx-auto px-4 pt-7 pb-16 flex flex-col gap-[18px]">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <h1 className="text-22 font-semibold">{load.cycle.name}</h1>
          <p className="text-14 text-stone">
            {plural(orgs.length, 'organisation')} · deadline {formatDay(load.cycle.deadlineOn)}
          </p>
        </div>
        <button type="button" className="vs-btn vs-btn-sm vs-btn-outline" onClick={downloadExcel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
          </svg>
          Download Excel
        </button>
      </div>

      <div role="group" aria-label="Filter" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {TILES.map((t) => {
          const on = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(on ? null : t.key)}
              className={`focus-ring vs-card px-[18px] py-4 text-left flex flex-col gap-0.5 cursor-pointer hover:border-brand-light ${on ? '!border-brand shadow-selected' : ''}`}
            >
              <span className="text-28 font-semibold">{orgs.filter((o) => t.test(o.state, o)).length}</span>
              <span className="font-medium">{t.label}</span>
              <span className="text-13 text-stone">{t.sub(orgs)}</span>
            </button>
          );
        })}
      </div>

      <section className="vs-card overflow-hidden">
        <div className="px-4 py-3.5 flex flex-wrap gap-2.5 justify-between items-center">
          <p className="font-semibold">
            {tile ? tile.label : 'All organisations'} · {rows.length}
          </p>
          <input
            type="search"
            className="vs-select w-[260px] max-w-full"
            placeholder="Search organisations"
            aria-label="Search organisations"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-14">
            <thead>
              <tr className="text-left text-stone">
                {['Organisation', 'Progress', 'Files', 'Not yet reviewed', 'Last upload'].map((h) => (
                  <th key={h} scope="col" className="font-medium px-4 py-2.5 border-b border-sand">
                    {h}
                  </th>
                ))}
                <th scope="col" className="border-b border-sand">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const noDocs = o.state.key === 'none' || o.state.key === 'not_started';
                return (
                  <tr key={o.id} className="border-b border-sand-line last:border-b-0">
                    <td className="px-4 py-3">
                      <Link to={adminRoutes.organisation(o.id)} className="font-medium no-underline hover:underline">
                        {o.name}
                      </Link>
                      <div className="text-13 text-stone">{o.state.text}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2.5 items-center">
                        <div className="w-[90px] h-1.5 bg-sand rounded-full overflow-hidden">
                          <div className="h-full bg-brand" style={{ width: `${o.progress}%` }} />
                        </div>
                        <span className="text-stone">{o.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{o.filesUploaded || '—'}</td>
                    <td className={`px-4 py-3 ${o.notReviewed ? 'font-semibold' : ''}`}>{o.notReviewed ? plural(o.notReviewed, 'file') : '—'}</td>
                    <td className="px-4 py-3 text-stone">{o.lastUploadAt ? formatShortDay(o.lastUploadAt.slice(0, 10), today) : '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {noDocs ? (
                        <button type="button" className="vs-btn vs-btn-xs vs-btn-outline" onClick={() => remind(o)} disabled={reminded[o.id]}>
                          {reminded[o.id] ? 'Reminder sent' : 'Send reminder'}
                        </button>
                      ) : (
                        <Link className="vs-btn vs-btn-xs vs-btn-outline" to={adminRoutes.organisation(o.id)} aria-label={`Open ${o.name}`}>
                          Open
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone">
                    {orgs.length ? (
                      'No organisations match.'
                    ) : (
                      <>
                        No organisations yet. <Link to={adminRoutes.setup()}>Add one in Setup</Link>, or share the sign-in page so they can register.
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
