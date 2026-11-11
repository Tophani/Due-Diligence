// Completion rules for the vendor form (the server uses the same rules: server/src/rules.js).
// Progress counts only REQUIRED, VISIBLE items that are done: optional items and hidden
// conditional items are left out.
import { BYREF, CHECK, CHECKLIST_SECTION, COND, DETAIL, ITEMS, OPTIONAL, SECS } from '../data/questionnaire.js';

const entry = (answers, ref) => answers[ref] || {};

export const isRequired = (item) => !OPTIONAL[item.ref];

/** A conditional item is shown only when its controlling Yes/No item is answered "Yes". */
export function isVisible(item, answers) {
  const parent = COND[item.ref];
  return !parent || entry(answers, parent).v === 'Yes';
}

export function isDone(item, answers) {
  const e = entry(answers, item.ref);
  if (item.t === 'f') return !!e.tt || (e.na && !!(e.why || '').trim()) || (e.files || []).length > 0;
  if (item.t === 'c') return !!(e.c || []).length;
  if (item.t === 'r') return (e.rows || []).some((r) => (r[0] || '').trim());
  if (item.t === 'y') return !!e.v && !(e.v === 'Yes' && DETAIL[item.ref] && !(e.detail || '').trim());
  return !!(e.v || '').toString().trim();
}

/** Visible items of a section, in questionnaire order. */
export function visibleItems(sec, answers) {
  return ITEMS.filter((i) => i.sec === sec && isVisible(i, answers));
}

/** Section 12: each checklist document and whether it has been provided in sections 1–11. */
export function checklistRows(answers) {
  return CHECK.map(([doc, ref], k) => {
    const item = BYREF[ref];
    return { n: k + 1, doc, ref, sec: item.sec, missing: !isDone(item, answers), na: !!entry(answers, ref).na };
  });
}

/** { total, done } for one section. */
function sectionStats(sec, answers) {
  if (sec === CHECKLIST_SECTION) {
    const rows = checklistRows(answers);
    return { total: rows.length, done: rows.filter((r) => !r.missing).length };
  }
  const req = visibleItems(sec, answers).filter(isRequired);
  return { total: req.length, done: req.filter((i) => isDone(i, answers)).length };
}

/** Per-section progress plus overall progress (sections 1–11; the checklist fills itself). */
export function assessmentProgress(answers) {
  const sections = SECS.map((title, k) => ({ n: k + 1, title, ...sectionStats(k + 1, answers) }));
  let total = 0;
  let done = 0;
  sections
    .filter((s) => s.n !== CHECKLIST_SECTION)
    .forEach((s) => {
      total += s.total;
      done += s.done;
    });
  return { sections, total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}
