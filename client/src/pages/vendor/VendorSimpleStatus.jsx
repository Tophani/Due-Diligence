import { Link } from 'react-router-dom';
import { Card, HeaderCard, Muted, UserLinks } from '../../components/vendor/SimpleShell.jsx';
import { useAssessment } from '../../context/assessmentContext.js';
import clsx from '../../lib/clsx.js';
import { formatDay } from '../../lib/format.js';
import { vendorRoutes } from '../../lib/routes.js';

const STEPS = ['Submitted', 'TracTrac reviews your documents', 'Review finished'];
const STEP_OF = { submitted: 0, reviewing: 1, finished: 2 };

/** `/submitted` — after submitting (due-diligence-final/vendor/VendorSimpleStatus). */
export default function VendorSimpleStatus() {
  const { submission, reviewStage } = useAssessment();

  if (!submission) {
    return (
      <>
        <HeaderCard note={<UserLinks />} className="gap-3 items-start">
          <h1 className="text-24 font-semibold">You haven&apos;t submitted this form yet</h1>
          <p>Once you&apos;ve submitted it, your reference number appears here.</p>
          <Link className="vs-btn vs-btn-primary" to={vendorRoutes.review()}>
            Check and submit
          </Link>
        </HeaderCard>
      </>
    );
  }

  const si = STEP_OF[reviewStage] ?? 0;
  const finished = reviewStage === 'finished';

  return (
    <>
      <HeaderCard note={<UserLinks />} className="!p-7 gap-3.5">
        <span className="w-11 h-11 rounded-full bg-brand flex items-center justify-center" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-ink">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
        <h1 className="text-24 font-semibold">{finished ? 'TracTrac has finished reviewing your form' : 'Thank you, your form has been submitted'}</h1>
        <p>{finished ? 'You’ll receive the outcome by email.' : 'Your answers are now locked while TracTrac checks your documents.'}</p>
        <Muted>
          Reference <span className="font-mono text-ink">{submission.reference}</span> · submitted {formatDay(submission.submittedAt.slice(0, 10))} · a copy was emailed to
          you
        </Muted>
        <p className="text-14 bg-sand-50 rounded-md px-3 py-2.5">
          Submitting doesn&apos;t mean your organisation has been approved. TracTrac will let you know the outcome.
        </p>
      </HeaderCard>

      <Card className="px-7 py-5 flex flex-col gap-3">
        <h2 className="text-16 font-semibold">What happens next</h2>
        <ol className="list-none m-0 p-0 flex flex-col gap-2.5">
          {STEPS.map((label, i) => {
            const done = i < si || i === 0 || (i === si && finished);
            return (
              <li key={label} className="flex gap-3 items-center" aria-current={i === si ? 'step' : undefined}>
                <span
                  className={clsx(
                    'w-6 h-6 rounded-full flex flex-none items-center justify-center text-12 font-semibold',
                    i <= si ? 'bg-brand text-ink' : 'bg-sand-50 text-stone shadow-[inset_0_0_0_1px_#DCD6CD]',
                  )}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={clsx(i === si && 'font-semibold', i > si && 'text-stone')}>{label}</span>
              </li>
            );
          })}
        </ol>
        <Muted>If TracTrac needs anything else, they&apos;ll email you directly.</Muted>
      </Card>

      <div className="flex flex-wrap gap-2.5">
        <Link className="vs-btn vs-btn-outline" to={vendorRoutes.section(1)}>
          View what you submitted
        </Link>
        <Link className="vs-btn vs-btn-outline" to={vendorRoutes.dashboard()}>
          Back to start
        </Link>
      </div>
    </>
  );
}
