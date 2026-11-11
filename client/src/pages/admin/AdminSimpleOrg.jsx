import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check } from '../../components/vendor/SimpleShell.jsx';
import { useAdmin } from '../../context/adminContext.js';
import { CHECKLIST_SECTION, COND, ITEMS, SECS } from '../../data/questionnaire.js';
import { api, uploadFile } from '../../lib/api.js';
import { ACCEPT_ATTR, formatSize, validateFile } from '../../lib/files.js';
import { formatShortDay, plural, todayIso } from '../../lib/format.js';
import { adminRoutes } from '../../lib/routes.js';

let nextId = 1;
const firstName = (name) => (name || '').split(' ')[0];
const shortDay = (iso) => formatShortDay(iso.slice(0, 10), todayIso());
const latestReview = (docs) => docs.reduce((best, d) => (!best || d.reviewedAt > best.reviewedAt ? d : best), null);

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" className="flex-none text-stone">
      <path d="M14 3H6v18h12V7zM14 3v4h4" />
    </svg>
  );
}
function Chevron({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="flex-none text-stone">
      <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

/** `/admin/organisations/:id` — due-diligence-final/admin/AdminSimpleOrg. */
export default function AdminSimpleOrg() {
  const { id } = useParams();
  const [load, setLoad] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    api(`/admin/organisations/${encodeURIComponent(id)}`)
      .then((data) => live && setLoad({ status: 'ready', data }))
      .catch((err) => live && setLoad({ status: 'error', message: err.status === 404 ? 'Organisation not found' : err.message }));
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <main className="max-w-[900px] mx-auto px-4 pt-6 pb-16 flex flex-col gap-3.5">
      <Link to={adminRoutes.dashboard()} className="text-14 self-start">
        ← All organisations
      </Link>
      {load.status === 'loading' && <p className="text-14 text-stone">Loading…</p>}
      {load.status === 'error' && (
        <section className="vs-card px-6 py-[22px]">
          <h1 className="text-22 font-semibold">{load.message}</h1>
        </section>
      )}
      {load.status === 'ready' && <Organisation key={id} initial={load.data} />}
    </main>
  );
}

function Organisation({ initial }) {
  const { showToast } = useAdmin();
  const { organisation: org, assessment } = initial;
  const [docs, setDocs] = useState(initial.documents);
  const [reminded, setReminded] = useState(false);
  const notApplicable = Object.fromEntries((assessment?.notApplicable || []).map((n) => [n.ref, n.reason || '']));

  /** Replace an item's documents with the server's latest (after review / undo). */
  const replaceItem = (ref, fresh) => setDocs((list) => [...list.filter((d) => d.itemRef !== ref), ...fresh]);
  const add = (added) => setDocs((list) => [...list, ...added]);

  const sections = SECS.map((title, k) => {
    const n = k + 1;
    if (n === CHECKLIST_SECTION) return { n, title, items: [], meta: 'Built from sections 1–11' };
    const secDocs = docs.filter((d) => Number(d.itemRef.split('.')[0]) === n);
    const items = ITEMS.filter((i) => i.sec === n && i.t === 'f' && (!COND[i.ref] || secDocs.some((d) => d.itemRef === i.ref)));
    const unreviewedItems = new Set(secDocs.filter((d) => !d.reviewedAt).map((d) => d.itemRef)).size;
    let meta = 'Written answers';
    if (unreviewedItems) meta = `${unreviewedItems} not yet reviewed`;
    else if (secDocs.length) meta = 'All reviewed';
    else if (items.length) meta = 'Nothing yet';
    return { n, title, items, docs: secDocs, meta, strong: unreviewedItems > 0 };
  });
  const [open, setOpen] = useState(() => {
    const first = sections.find((s) => s.strong);
    return first ? { [first.n]: true } : {};
  });

  const unreviewed = docs.filter((d) => !d.reviewedAt).length;
  const withFiles = docs.filter((d) => d.hasFile).length;
  const today = todayIso();
  const state = !assessment
    ? 'Not in the current cycle'
    : assessment.submittedAt
      ? 'Submitted'
      : docs.length || assessment.progress > 0
        ? 'In progress'
        : assessment.firstSubmissionOn && today > assessment.firstSubmissionOn
          ? 'No documents yet'
          : 'Not started';

  const remind = async () => {
    try {
      const { message } = await api(`/admin/organisations/${org.id}/reminder`, { method: 'POST' });
      setReminded(true);
      showToast(message);
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <>
      <section className="vs-card vs-card-top px-6 py-[22px] flex flex-wrap gap-x-6 gap-y-3.5 justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-22 font-semibold">{org.name}</h1>
          <p className="text-14 text-stone">{[org.contactName, org.contactEmail, org.regNumber].filter(Boolean).join(' · ')}</p>
          <p className="text-14 mt-1">
            {state}
            {assessment && (
              <>
                {' '}
                · {assessment.progress}% complete · {plural(docs.length, 'file')} · <span className="font-semibold">{unreviewed} not yet reviewed</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {assessment && !assessment.submittedAt && (
            <button type="button" className="vs-btn vs-btn-sm vs-btn-outline" onClick={remind} disabled={reminded}>
              {reminded ? 'Reminder sent' : 'Send reminder'}
            </button>
          )}
          {withFiles > 0 ? (
            <a className="vs-btn vs-btn-sm vs-btn-primary" href={`/api/admin/organisations/${org.id}/files.zip`} download>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
              </svg>
              Download all files (ZIP)
            </a>
          ) : (
            <button type="button" className="vs-btn vs-btn-sm vs-btn-primary" disabled title="No files to download yet">
              Download all files (ZIP)
            </button>
          )}
        </div>
      </section>

      {!assessment ? (
        <section className="vs-card px-6 py-5">
          <p className="text-14 text-stone">This organisation isn&apos;t in an open cycle.</p>
        </section>
      ) : (
        <section className="vs-card overflow-hidden">
          {sections.map((s) => {
            const isOpen = !!open[s.n];
            return (
              <div key={s.n} className="border-t border-sand-line first:border-t-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`sec-${s.n}`}
                  onClick={() => setOpen((o) => ({ ...o, [s.n]: !isOpen }))}
                  className="focus-ring w-full flex gap-3.5 items-center bg-transparent border-0 px-5 py-3.5 text-left cursor-pointer hover:bg-sand-hover"
                >
                  <span className="w-[22px] text-14 text-stone">{s.n}</span>
                  <span className="flex-1 font-medium">{s.title}</span>
                  <span className={`text-14 ${s.strong ? 'font-semibold' : 'text-stone'}`}>{s.meta}</span>
                  <Chevron open={isOpen} />
                </button>
                {isOpen && (
                  <div id={`sec-${s.n}`} className="pl-14 pr-5 pb-3">
                    {!s.items.length && (
                      <p className="text-14 text-stone pt-2 pb-1">
                        {s.n === CHECKLIST_SECTION ? 'This list is built from the documents in sections 1–11.' : 'Written answers only. No documents are asked for in this section.'}
                      </p>
                    )}
                    {s.items.map((item) => (
                      <Requirement
                        key={item.ref}
                        orgId={org.id}
                        item={item}
                        docs={s.docs.filter((d) => d.itemRef === item.ref)}
                        notApplicable={notApplicable[item.ref]}
                        onReplaced={(fresh) => replaceItem(item.ref, fresh)}
                        onAdded={add}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

/** One requested document: its files (Download), Mark as reviewed / Undo, or Upload a file if missing. */
function Requirement({ orgId, item, docs, notApplicable, onReplaced, onAdded }) {
  const { showToast } = useAdmin();
  const fileInput = useRef(null);
  const [uploads, setUploads] = useState([]); // [{ id, name, pct }]
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const has = docs.length > 0;
  const reviewed = has && docs.every((d) => d.reviewedAt);
  const last = reviewed ? latestReview(docs) : null;
  const missing = !has && notApplicable === undefined;
  const itemPath = `/admin/organisations/${orgId}/items/${encodeURIComponent(item.ref)}/reviewed`;

  const setReviewed = async (on) => {
    setBusy(true);
    try {
      const { documents } = await api(itemPath, { method: on ? 'POST' : 'DELETE' });
      onReplaced(documents);
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const upload = (list) => {
    const bad = [];
    Array.from(list).forEach((file) => {
      const message = validateFile(file);
      if (message) return bad.push(`${file.name}: ${message}`);
      const id = nextId++;
      setUploads((u) => [...u, { id, name: file.name, pct: 0 }]);
      uploadFile(`/admin/organisations/${orgId}/documents/${encodeURIComponent(item.ref)}`, file, {
        onProgress: (pct) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct } : x))),
      })
        .promise.then((data) => {
          onAdded(data.documents);
          showToast(`${file.name} added for ${item.ref}`);
        })
        .catch((err) => setErrors((e) => [...e, `${file.name}: ${err.message}`]))
        .finally(() => setUploads((u) => u.filter((x) => x.id !== id)));
    });
    setErrors(bad);
  };

  return (
    <div className="py-3 border-t border-sand-line flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-center">
        <span className="font-mono text-12 text-stone w-10">{item.ref}</span>
        <span className="flex-[1_1_240px] font-medium text-14">{item.title}</span>
        {has && !reviewed && (
          <button type="button" className="vs-btn vs-btn-xs vs-btn-outline" onClick={() => setReviewed(true)} disabled={busy}>
            Mark as reviewed
          </button>
        )}
        {reviewed && (
          <span className="text-13 inline-flex gap-1.5 items-center">
            <Check />
            Reviewed by {firstName(last.reviewedBy) || 'TracTrac'}, {shortDay(last.reviewedAt)} ·{' '}
            <button type="button" className="vs-link !text-13" onClick={() => setReviewed(false)} disabled={busy}>
              Undo
            </button>
          </span>
        )}
      </div>

      {docs.map((d) => (
        <div key={d.id} className="ml-[52px] flex flex-wrap gap-x-3 gap-y-1.5 items-center px-2.5 py-2 border border-sand rounded-md">
          <FileIcon />
          <span className="flex-[1_1_200px] min-w-0 text-14 [overflow-wrap:anywhere]">
            {d.fileName}{' '}
            <span className="text-13 text-stone">
              · {d.size != null ? formatSize(d.size) : '—'} ·{' '}
              {d.addedByTractrac ? `added by TracTrac${d.uploadedBy ? ` (${firstName(d.uploadedBy)})` : ''}` : d.uploadedBy || 'the vendor'}, {shortDay(d.createdAt)}
              {!d.reviewedAt && ' · not yet reviewed'}
            </span>
          </span>
          {d.hasFile ? (
            <a className="vs-btn vs-btn-xs vs-btn-outline !min-h-8" href={`/api/documents/${d.id}/file`} download aria-label={`Download ${d.fileName}`}>
              Download
            </a>
          ) : (
            <span className="text-12 text-stone">File not available</span>
          )}
        </div>
      ))}

      {!has && notApplicable !== undefined && <p className="ml-[52px] text-14 text-stone">Doesn&apos;t apply{notApplicable ? `: ${notApplicable}` : ''}</p>}

      {uploads.map((u) => (
        <p key={u.id} className="ml-[52px] text-14 text-stone">
          Uploading {u.name}… {u.pct}%
        </p>
      ))}
      {errors.map((m) => (
        <p key={m} role="alert" className="ml-[52px] text-13 text-error">
          {m}
        </p>
      ))}

      {missing && (
        <div className="ml-[52px] flex flex-wrap gap-3 items-center">
          <span className="text-14 text-stone">Not uploaded yet</span>
          <button type="button" className="vs-btn vs-btn-xs vs-btn-outline !min-h-8" onClick={() => fileInput.current?.click()} disabled={uploads.length > 0}>
            Upload a file
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}
