import { Fragment, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toast } from '../../components/ui';
import SimpleQuestion from '../../components/vendor/SimpleQuestion.jsx';
import { Bar, Card, HeaderCard, Muted, SaveNote} from '../../components/vendor/SimpleShell.jsx';
import { useAssessment } from '../../context/assessmentContext.js';
import { CHECKLIST_SECTION, DEFAULT_INTRO, INTRO, SECS, SECTION_COUNT, SUBS } from '../../data/questionnaire.js';
import { checklistRows, visibleItems } from '../../lib/assessmentProgress.js';
import { formatDay } from '../../lib/format.js';
import { vendorRoutes } from '../../lib/routes.js';

/** `/form/:section` — one section of the form, one card per question (due-diligence-final/vendor/VendorSimpleForm). */
export default function VendorSimpleForm() {
  const { section } = useParams();
  const n = Number(section);
  if (!(Number.isInteger(n) && n >= 1 && n <= SECTION_COUNT)) return <Navigate to={vendorRoutes.section(1)} replace />;
  return <Section key={n} n={n} />;
}

function Section({ n }) {
  const { cycle, answers, save, retrySave, toast, locked, submission } = useAssessment();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const isChecklist = n === CHECKLIST_SECTION;
  const isLast = n === SECTION_COUNT;

  // New section: start at the top, or at the linked question (e.g. #item-2-1-3).
  useEffect(() => {
    const target = hash && document.getElementById(hash.slice(1));
    if (target) target.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [hash]);

  const items = isChecklist ? [] : visibleItems(n, answers);

  const next = () => {
    if (!isLast) navigate(vendorRoutes.section(n + 1));
    else if (!locked) navigate(vendorRoutes.review());
    else navigate(submission ? vendorRoutes.status() : vendorRoutes.dashboard());
  };

  return (
    <>
      <HeaderCard note={locked ? 'Read only' : <SaveNote save={save} onRetry={retrySave} />} className="gap-3">
        <Muted>
          Section {n} of {SECTION_COUNT}
        </Muted>
        <h1 className="text-24 font-semibold">{SECS[n - 1]}</h1>
        <p>{INTRO[n] || DEFAULT_INTRO}</p>
        <Bar percent={Math.round((n / SECTION_COUNT) * 100)} height="h-1.5" label="Section progress" aria-valuemin={1} aria-valuemax={SECTION_COUNT} aria-valuenow={n} />
        {!isChecklist && !locked && <p className="text-13 text-error">* Required</p>}
      </HeaderCard>

      {locked && (
        <Card className="px-7 py-4">
          {submission ? (
            <p>
              You&apos;ve submitted this form, so your answers can&apos;t be changed. <Link to={vendorRoutes.status()}>See your submission</Link>
            </p>
          ) : (
            <p>This form closed on {formatDay(cycle.deadline)}. Your answers can&apos;t be changed.</p>
          )}
        </Card>
      )}

      {items.map((item, k) => (
        <Fragment key={item.ref}>
          {(k === 0 || items[k - 1].sub !== item.sub) && <h2 className="text-17 font-semibold px-1 pt-3.5">{SUBS[item.sub]}</h2>}
          <SimpleQuestion item={item} />
        </Fragment>
      ))}

      {isChecklist && <Checklist answers={answers} />}

      <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
        <div className="flex gap-2.5">
          {n > 1 && (
            <button type="button" className="vs-btn vs-btn-outline" onClick={() => navigate(vendorRoutes.section(n - 1))}>
              Back
            </button>
          )}
          <button type="button" className="vs-btn vs-btn-primary" onClick={next}>
            Next
          </button>
        </div>
        <Link to={vendorRoutes.dashboard()} className="text-14">
          {locked ? 'Back to start' : 'Save and finish later'}
        </Link>
      </div>

      <Toast message={toast} />
    </>
  );
}

/** Section 12: the documents TracTrac needs, worked out from the answers in sections 1–11. */
function Checklist({ answers }) {
  return (
    <Card as="ol" className="list-none m-0 py-2 px-0">
      {checklistRows(answers).map((r) => (
        <li key={r.n} className="flex gap-3.5 items-center px-7 py-3 border-t border-sand-line first:border-t-0">
          <span className="w-[22px] text-14 text-stone">{r.n}</span>
          <span className="flex-1">{r.doc}</span>
          {r.missing ? (
            <Link to={vendorRoutes.section(r.sec, r.ref)} className="text-14">
              Add it in section {r.sec}
            </Link>
          ) : (
            <span className="text-14 font-semibold">{r.na ? 'Doesn’t apply' : '✓ Done'}</span>
          )}
        </li>
      ))}
    </Card>
  );
}
