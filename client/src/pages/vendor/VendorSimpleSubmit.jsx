import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Card, HeaderCard, Muted, SaveNote} from '../../components/vendor/SimpleShell.jsx';
import { useAssessment } from '../../context/assessmentContext.js';
import { SECS, SECTION_COUNT } from '../../data/questionnaire.js';
import { reviewSummary } from '../../lib/reviewSummary.js';
import { vendorRoutes } from '../../lib/routes.js';

/**
 * Sections with something still to do, each with a short note and a link to its first open item.
 * (Section 12 is worked out from the other sections, so it never appears here.)
 */
function stillNeeded(s) {
  const bySec = new Map();
  const add = (kind) => (i) => {
    if (!bySec.has(i.sec)) bySec.set(i.sec, { n: i.sec, title: SECS[i.sec - 1], docs: 0, questions: 0 });
    bySec.get(i.sec)[kind]++;
  };
  s.missingDocs.forEach(add('docs'));
  s.unanswered.forEach(add('questions'));
  return [...bySec.values()]
    .sort((a, b) => a.n - b.n)
    .map((r) => {
      const parts = [];
      const missing = r.docs + r.questions;
      if (missing) parts.push(`${missing} ${r.questions ? (missing === 1 ? 'item' : 'items') : missing === 1 ? 'document' : 'documents'} missing`);
      const first = [...s.missingDocs, ...s.unanswered]
        .filter((i) => i.sec === r.n)
        .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }))[0].ref;
      return { ...r, first, note: parts.join(' · ') };
    });
}

/**
 * `/submit` — check and submit (due-diligence-final/vendor/VendorSimpleSubmit).
 * Replaces the review page; submitting goes straight to the status page, which says thank you.
 */
export default function VendorSimpleSubmit() {
  const { meta, cycle, answers, submission, submit, save, retrySave, cycleClosed } = useAssessment();
  const navigate = useNavigate();
  const [declared, setDeclared] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const s = useMemo(() => reviewSummary(answers), [answers]);

  if (submission || cycleClosed) return <Navigate to={submission ? vendorRoutes.status() : vendorRoutes.dashboard()} replace />;

  const ready = s.complete;
  const completeEnough = ready || !!cycle?.settings.allowIncompleteSubmit; // cycle setting
  const canSubmit = completeEnough && declared && !sending && save.status === 'saved';
  const todo = ready ? [] : stillNeeded(s);
  const why = !completeEnough
    ? 'You can submit once everything above is done'
    : !declared
      ? 'Tick the box to submit'
      : save.status !== 'saved'
        ? 'Waiting for your last changes to save'
        : '';

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setError('');
    try {
      await submit();
      navigate(vendorRoutes.status());
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  return (
    <>
      <HeaderCard note={<SaveNote save={save} onRetry={retrySave} />} className="gap-2">
        <Muted>Last step</Muted>
        <h1 className="text-24 font-semibold">Check and submit</h1>
        <p>
          {ready
            ? 'Everything is filled in. Tick the box below and submit.'
            : `A few things are still missing. You can come back and finish any time before ${meta.due}.`}
        </p>
      </HeaderCard>


      {todo.length > 0 && (
        <Card className="py-2">
          <h2 className="text-16 font-semibold px-7 pt-3.5 pb-1">Still needed</h2>
          <Muted className="px-7 pb-2.5">Select a section to go straight to what’s missing.</Muted>
          <ul className="list-none m-0 p-0">
            {todo.map((t) => (
              <li key={t.n}>
                <Link
                  to={vendorRoutes.section(t.n, t.first)}
                  className="focus-ring flex gap-3.5 items-center px-7 py-3 border-t border-sand-line no-underline text-ink hover:text-ink hover:bg-sand-hover"
                >
                  <span className="flex-1">
                    <span className="block">
                      {t.n}. {t.title}
                    </span>
                    <span className="block text-13 text-stone">{t.note}</span>
                  </span>
                  <span className="text-14 underline">Go</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="px-7 py-[22px] flex flex-col gap-4">
        <label className="flex gap-3 items-start cursor-pointer">
          <input
            type="checkbox"
            checked={declared}
            onChange={() => setDeclared((d) => !d)}
            className="focus-ring w-5 h-5 mt-0.5 flex-none accent-brand"
          />
          <span>
            I confirm the information and documents I&apos;ve provided are accurate and complete, and that I&apos;m authorised to submit them for{' '}
            <span className="font-semibold">{meta.organisationLegalName}</span>.
          </span>
        </label>
        <div className="flex flex-wrap gap-3 items-center">
          <button type="button" className="vs-btn vs-btn-lg vs-btn-primary" disabled={!canSubmit} onClick={onSubmit} aria-describedby="submit-why">
            {sending ? 'Submitting…' : 'Submit'}
          </button>
          <span id="submit-why" className="text-14 text-stone">
            {why}
          </span>
        </div>
        {error && (
          <p role="alert" className="text-14 text-error">
            {error}
          </p>
        )}
      </Card>

      <div className="pt-1">
        <Link className="vs-btn vs-btn-lg vs-btn-outline" to={vendorRoutes.section(SECTION_COUNT)}>
          Back
        </Link>
      </div>
    </>
  );
}
