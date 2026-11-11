import { Link } from 'react-router-dom';
import { Bar, Card, HeaderCard, Muted, UserLinks } from '../../components/vendor/SimpleShell.jsx';
import { useAssessment } from '../../context/assessmentContext.js';
import { formatDay } from '../../lib/format.js';
import { vendorRoutes } from '../../lib/routes.js';
import { progressPhrase, resumePoint, sectionState } from '../../lib/vendorWords.js';

/** `/` — the vendor's start page (due-diligence-final/vendor/VendorSimpleStart). */
export default function VendorSimpleStart() {
  const { meta, cycle, answers, progress, submission, cycleClosed } = useAssessment();
  const resume = resumePoint(answers);
  const started = progress.done > 0;

  return (
    <>
      <HeaderCard linkHome={false} note={<UserLinks signOut />} className="!p-7 gap-4">
        <div>
          <h1 className="text-24 font-semibold">{meta.assessmentName}</h1>
          <Muted className="mt-1">
            {meta.organisationName} ·{' '}
            {cycleClosed ? (
              <>closed on {formatDay(cycle.deadline)}</>
            ) : submission ? (
              <>submitted {formatDay(submission.submittedAt.slice(0, 10))}</>
            ) : (
              <>
                please complete by <span className="text-ink font-semibold">{meta.due}</span>
              </>
            )}
          </Muted>
        </div>

        {!submission && !cycleClosed && (
          <>
            <div>
              <Bar percent={progress.percent} label="Form progress" />
              <Muted className="mt-1.5">{progressPhrase(progress.percent)} · your answers save automatically</Muted>
            </div>
            <div>
              <Link className="vs-btn vs-btn-lg vs-btn-primary" to={vendorRoutes.section(resume.sec, resume.ref)}>
                {started ? 'Continue where you left off' : 'Start'}
              </Link>
            </div>
          </>
        )}

        {submission && (
          <>
            <p>Thank you, your form has been submitted. TracTrac will let you know the outcome.</p>
            <div>
              <Link className="vs-btn vs-btn-lg vs-btn-primary" to={vendorRoutes.status()}>
                See your submission
              </Link>
            </div>
          </>
        )}

        {!submission && cycleClosed && <p>This form is closed. You can still look at your answers below.</p>}
      </HeaderCard>

      <Card className="py-2">
        <h2 className="text-15 font-semibold px-6 pt-3.5 pb-2">Sections</h2>
        <ol className="list-none m-0 p-0">
          {progress.sections.map((s) => {
            const st = sectionState(s);
            return (
              <li key={s.n}>
                <Link
                  to={vendorRoutes.section(s.n)}
                  className="focus-ring flex gap-3.5 items-center px-6 py-3 no-underline text-ink hover:bg-sand-hover border-t border-sand-line"
                >
                  <span className="w-[22px] text-14 text-stone">{s.n}</span>
                  <span className="flex-1">{s.title}</span>
                  <span className={`text-14 ${st.className}`}>{st.text}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>

      <Muted className="text-center !text-13">Questions about the form? Contact the TracTrac Partnership Manager.</Muted>
    </>
  );
}
