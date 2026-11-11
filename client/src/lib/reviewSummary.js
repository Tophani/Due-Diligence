// Everything the review and confirmation screens show, derived from the answers.
// Uses the same rules as the workspace (assessmentProgress.js): required + visible items only.
import { CHECKLIST_SECTION, SECS } from '../data/questionnaire.js';
import { checklistRows, isDone, isRequired, visibleItems } from './assessmentProgress.js';

const isDoc = (i) => i.t === 'f';

/**
 * @returns {{
 *   sections: {n,title,q,qd,d,dd,total,done}[],   // q/qd questions, d/dd documents
 *   sectionsComplete: number, sectionCount: number,
 *   questions: {total,done}, documents: {total,done},
 *   outstanding: number,          // required visible items not done (sections 1–11)
 *   complete: boolean,
 *   missingDocs: Item[], unanswered: Item[],
 * }}
 */
export function reviewSummary(answers) {
  const sections = [];
  const missingDocs = [];
  const unanswered = [];
  let qTotal = 0, qDone = 0, dTotal = 0, dDone = 0;

  for (let n = 1; n < CHECKLIST_SECTION; n++) {
    const list = visibleItems(n, answers);
    const req = list.filter(isRequired);
    const qs = req.filter((i) => !isDoc(i));
    const ds = req.filter(isDoc);
    const qd = qs.filter((i) => isDone(i, answers)).length;
    const dd = ds.filter((i) => isDone(i, answers)).length;
    qTotal += qs.length; qDone += qd; dTotal += ds.length; dDone += dd;

    list.forEach((i) => {
      if (isRequired(i) && !isDone(i, answers)) (isDoc(i) ? missingDocs : unanswered).push(i);
    });

    sections.push({ n, title: SECS[n - 1], q: qs.length, qd, d: ds.length, dd, total: req.length, done: qd + dd });
  }

  const rows = checklistRows(answers);
  const listed = rows.filter((r) => !r.missing).length;
  sections.push({ n: CHECKLIST_SECTION, title: SECS[CHECKLIST_SECTION - 1], q: 0, qd: 0, d: rows.length, dd: listed, total: rows.length, done: listed });

  const outstanding = qTotal - qDone + (dTotal - dDone);
  return {
    sections,
    sectionsComplete: sections.filter((s) => s.done === s.total).length,
    sectionCount: sections.length,
    questions: { total: qTotal, done: qDone },
    documents: { total: dTotal, done: dDone },
    outstanding,
    complete: outstanding === 0,
    missingDocs,
    unanswered,
  };
}
