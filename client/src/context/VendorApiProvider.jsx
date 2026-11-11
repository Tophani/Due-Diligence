import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssessmentContext } from './assessmentContext.js';
import { HeaderCard, UserLinks } from '../components/vendor/SimpleShell.jsx';
import { api, uploadFile } from '../lib/api.js';
import { assessmentProgress } from '../lib/assessmentProgress.js';
import { formatSize, validateFile } from '../lib/files.js';
import { formatDay } from '../lib/format.js';

const SAVE_DELAY_MS = 800; // save an answer this long after typing stops
const TOAST_MS = 2800;
const ANSWER_KEYS = ['v', 'detail', 'c', 'other', 'rows'];

let nextId = 1;
const uid = () => `u${nextId++}`;

/** Server answer row -> the screen's entry { v, detail, c, other, rows, na, why }. */
const toEntry = (a) => ({ ...(a.value || {}), na: a.not_applicable, why: a.reason || '' });

/** The screen's entry -> PUT /api/my/answers body. */
function toBody(e = {}) {
  const value = {};
  ANSWER_KEYS.forEach((k) => {
    if (e[k] !== undefined && e[k] !== '') value[k] = e[k];
  });
  return { value: Object.keys(value).length ? value : null, notApplicable: !!e.na, reason: e.na ? e.why || '' : null };
}

/** Server document -> the screen's file. `reviewed`: checked by TracTrac, so it can't be removed. */
const toFile = (d) => ({
  docId: d.id,
  name: d.file_name,
  size: d.size != null ? formatSize(d.size) : '',
  when: formatDay(d.created_at.slice(0, 10)),
  url: d.has_file ? `/api/documents/${d.id}/file` : null,
  reviewed: d.reviewed,
});

/** A message in the page's main card (with the logo), e.g. "No form to fill in right now". */
function Message({ title, children }) {
  return (
    <HeaderCard linkHome={false} note={<UserLinks signOut />} className="gap-3 items-start">
      <h1 className="text-22 font-semibold">{title}</h1>
      {children}
    </HeaderCard>
  );
}

/**
 * The signed-in vendor's assessment, from the server (GET /api/my/assessment). Provides what the
 * vendor screens read through useAssessment(). Answers save themselves 800 ms after a change;
 * files upload straight away with real progress.
 */
export default function VendorApiProvider({ children }) {
  const [load, setLoad] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    api('/my/assessment')
      .then((data) => live && setLoad({ status: 'ready', data }))
      .catch((err) => live && setLoad({ status: err.status === 404 ? 'none' : 'error', message: err.message }));
    return () => {
      live = false;
    };
  }, [attempt]);
  const retry = () => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  if (load.status === 'loading') return <p className="text-center text-14 text-stone pt-10">Loading your form…</p>;
  if (load.status === 'none') {
    return (
      <Message title="No form to fill in right now">
        <p>TracTrac will email you when your next due diligence form opens.</p>
      </Message>
    );
  }
  if (load.status === 'error') {
    return (
      <Message title="Your form didn’t load">
        <p>{load.message}</p>
        <button type="button" className="vs-btn vs-btn-primary" onClick={retry}>
          Try again
        </button>
      </Message>
    );
  }
  return <Assessment initial={load.data}>{children}</Assessment>;
}

function Assessment({ initial, children }) {
  const [raw, setRaw] = useState(() => Object.fromEntries(initial.answers.map((a) => [a.item_ref, toEntry(a)])));
  const [docs, setDocs] = useState(initial.documents);
  const [submission, setSubmission] = useState(initial.submission);
  const [toast, setToast] = useState('');
  const [uploads, setUploads] = useState({}); // ref -> [{ id, name, pct }]
  const [uploadErrors, setUploadErrors] = useState({}); // ref -> [{ id, name, message }]
  const [saving, setSaving] = useState({}); // ref -> { waiting, sending, failed, message }

  const toastTimer = useRef(null);
  const timers = useRef({}); // ref -> autosave timer
  const toSend = useRef({}); // ref -> latest entry to save
  const inFlight = useRef(new Set());
  const again = useRef(new Set()); // changed while a save was in flight: save once more after
  const jobs = useRef(new Map()); // upload id -> { abort }

  useEffect(() => {
    const pending = timers.current;
    const running = jobs.current;
    return () => {
      clearTimeout(toastTimer.current);
      Object.values(pending).forEach(clearTimeout);
      running.forEach((j) => j.abort());
    };
  }, []);

  const showToast = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), TOAST_MS);
  }, []);

  // ---- What the screens read --------------------------------------------------------------

  const cycle = useMemo(
    () => ({ id: String(initial.cycle.id), name: initial.cycle.name, deadline: initial.cycle.deadlineOn, status: initial.cycle.status, settings: { allowIncompleteSubmit: false } }),
    [initial.cycle],
  );
  const cycleId = cycle.id;
  const cycleClosed = cycle.status !== 'active';
  const meta = useMemo(
    () => ({
      cycleId,
      organisationName: initial.organisation.name,
      organisationLegalName: initial.organisation.name,
      assessmentName: cycle.name.split(' · ')[0],
      cycleName: cycle.name,
      due: formatDay(cycle.deadline),
    }),
    [cycleId, cycle, initial.organisation],
  );

  /** Answers with their files: { ref: { v, ..., na, why, files: [...], tt } }. */
  const answers = useMemo(() => {
    const out = Object.fromEntries(Object.entries(raw).map(([ref, e]) => [ref, { ...e }]));
    docs.forEach((d) => {
      const e = (out[d.item_ref] ||= {});
      if (d.added_by_tractrac) e.tt = toFile(d);
      else e.files = [...(e.files || []), toFile(d)];
    });
    return out;
  }, [raw, docs]);

  const progress = useMemo(() => assessmentProgress(answers), [answers]);
  // Where TracTrac's check has got (Status page): submitted → reviewing → finished.
  const reviewStage = docs.length && docs.every((d) => d.reviewed) ? 'finished' : docs.some((d) => d.reviewed) ? 'reviewing' : 'submitted';
  const locked = !!submission || cycleClosed; // the whole form locks once submitted or closed
  const isItemLocked = useCallback(() => locked, [locked]);

  // ---- Autosave ---------------------------------------------------------------------------

  const mark = useCallback(
    (ref, patch) =>
      setSaving((m) => {
        const next = { ...(m[ref] || {}), ...patch };
        const rest = { ...m };
        if (next.waiting || next.sending || next.failed) rest[ref] = next;
        else delete rest[ref];
        return rest;
      }),
    [],
  );

  /** Save one answer. One save per item at a time; if it changes meanwhile, save again after. */
  const send = useCallback(
    async (ref) => {
      if (inFlight.current.has(ref)) {
        again.current.add(ref);
        return;
      }
      inFlight.current.add(ref);
      try {
        do {
          again.current.delete(ref);
          mark(ref, { sending: true, failed: false });
          try {
            await api(`/my/answers/${encodeURIComponent(ref)}`, { method: 'PUT', body: toBody(toSend.current[ref]) });
            mark(ref, { sending: false });
          } catch (err) {
            mark(ref, { sending: false, failed: true, message: err.message });
          }
        } while (again.current.has(ref));
      } finally {
        inFlight.current.delete(ref);
      }
    },
    [mark],
  );

  /** Change an answer locally now; save it 800 ms after the last change. */
  const updateItem = useCallback(
    (ref, patch) => {
      if (locked) return;
      setRaw((prev) => {
        const next = { ...(prev[ref] || {}), ...patch };
        toSend.current[ref] = next;
        return { ...prev, [ref]: next };
      });
      clearTimeout(timers.current[ref]);
      mark(ref, { waiting: true });
      timers.current[ref] = setTimeout(() => {
        delete timers.current[ref];
        mark(ref, { waiting: false });
        send(ref);
      }, SAVE_DELAY_MS);
    },
    [locked, mark, send],
  );

  const failedRefs = Object.keys(saving).filter((r) => saving[r].failed);
  const busy = Object.values(saving).some((s) => s.waiting || s.sending);
  const save = { status: failedRefs.length ? 'error' : busy ? 'saving' : 'saved', message: failedRefs.length ? saving[failedRefs[0]].message : '' };
  const retrySave = useCallback(() => Object.keys(saving).filter((r) => saving[r].failed).forEach(send), [saving, send]);

  // Warn before leaving with changes that haven't reached the server.
  const unsaved = busy || failedRefs.length > 0;
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  // ---- Files ------------------------------------------------------------------------------

  const setJobs = (ref, fn) => setUploads((u) => ({ ...u, [ref]: fn(u[ref] || []) }));

  /** Check the files here first (type and size), then upload each one with its own progress. */
  const startUploads = useCallback(
    (ref, fileList) => {
      if (locked) return;
      const errors = [];
      Array.from(fileList).forEach((file) => {
        const message = validateFile(file);
        if (message) return errors.push({ id: uid(), name: file.name, message });
        const id = uid();
        const job = uploadFile(`/my/documents/${encodeURIComponent(ref)}`, file, {
          onProgress: (pct) => setJobs(ref, (list) => list.map((u) => (u.id === id ? { ...u, pct } : u))),
        });
        jobs.current.set(id, job);
        setJobs(ref, (list) => [...list, { id, name: file.name, pct: 0 }]);
        job.promise
          .then((data) => {
            setDocs((list) => [...list, ...data.documents]);
            // A file was given, so the item no longer "doesn't apply" (the server cleared it too).
            setRaw((prev) => (prev[ref]?.na ? { ...prev, [ref]: { ...prev[ref], na: false, why: '' } } : prev));
            showToast(`${file.name} uploaded`);
          })
          .catch((err) => {
            if (err.status === -1) return; // cancelled
            setUploadErrors((prev) => ({ ...prev, [ref]: [...(prev[ref] || []), { id, name: file.name, message: err.message }] }));
          })
          .finally(() => {
            jobs.current.delete(id);
            setJobs(ref, (list) => list.filter((u) => u.id !== id));
          });
      });
      setUploadErrors((prev) => ({ ...prev, [ref]: errors }));
    },
    [locked, showToast],
  );

  const cancelUpload = useCallback((id) => jobs.current.get(id)?.abort(), []);
  const clearUploadErrors = useCallback((ref) => setUploadErrors((prev) => ({ ...prev, [ref]: [] })), []);

  /** Remove one of the vendor's files (allowed until TracTrac marks it as reviewed). */
  const removeFile = useCallback(
    async (ref, index) => {
      const file = (answers[ref]?.files || [])[index];
      if (!file || locked) return;
      try {
        await api(`/my/documents/${file.docId}`, { method: 'DELETE' });
        setDocs((list) => list.filter((d) => d.id !== file.docId));
        showToast(`${file.name} removed`);
      } catch (err) {
        // TracTrac may have reviewed it meanwhile: show the server's reason and stop offering removal.
        if (err.status === 409) setDocs((list) => list.map((d) => (d.id === file.docId ? { ...d, reviewed: true } : d)));
        showToast(err.message);
      }
    },
    [answers, locked, showToast],
  );

  // ---- Submit -----------------------------------------------------------------------------

  /** Submit the form. Throws with the server's message if something is still missing. */
  const submit = useCallback(async () => {
    const data = await api('/my/submit', { method: 'POST', body: { declaration: true } });
    setSubmission(data.submission);
    return data.submission;
  }, []);

  const value = {
    cycleId,
    meta,
    cycle,
    cycleClosed,
    answers,
    progress,
    reviewStage,
    submission,
    locked,
    isItemLocked,
    submit,
    updateItem,
    save,
    retrySave,
    toast,
    showToast,
    uploads,
    uploadErrors,
    startUploads,
    cancelUpload,
    clearUploadErrors,
    removeFile,
  };
  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}
