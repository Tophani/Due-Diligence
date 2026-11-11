// Plain-language wording for the vendor screens (due-diligence-final/FINAL.md).
// Pure presentation: the underlying statuses stay as they are in the data.
import { CHECKLIST_SECTION, ITEMS } from '../data/questionnaire.js';
import { isDone, isRequired, isVisible } from './assessmentProgress.js';

/** "About half done" etc. for the overall progress bar. */
export function progressPhrase(percent) {
  if (percent >= 100) return 'Everything is filled in';
  if (percent >= 90) return 'Almost done';
  if (percent >= 56) return 'More than half done';
  if (percent >= 40) return 'About half done';
  if (percent > 0) return 'Started';
  return 'Not started yet';
}

/** Right-hand word on a section row: "✓ Done", "5 left", "Not started". */
export function sectionState(s) {
  if (s.done === s.total) return { text: '✓ Done', className: 'text-ink font-semibold' };
  if (s.done > 0) return { text: `${s.total - s.done} left`, className: 'text-ink' };
  return { text: 'Not started', className: 'text-stone' };
}

/** Where "Continue where you left off" goes: the first unfinished item. */
export function resumePoint(answers) {
  const todo = ITEMS.find((i) => i.sec < CHECKLIST_SECTION && isRequired(i) && isVisible(i, answers) && !isDone(i, answers));
  return todo ? { sec: todo.sec, ref: todo.ref } : { sec: CHECKLIST_SECTION, ref: null };
}
