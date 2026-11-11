// Questionnaire rules, the same as the vendor screen's (client/src/lib/assessmentProgress.js),
// but reading the questionnaire from the database instead of the client's copy.
//
// `content` is questionnaires.content: { ITEMS, COND, DETAIL, OPTIONAL, CHECKLIST_SECTION, SECS, ... }.

/** File types that may be uploaded (checked on the file's contents, not its name). */
export const ALLOWED_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const findItem = (content, ref) => content.ITEMS.find((i) => i.ref === ref) || null;
export const isFileItem = (content, ref) => findItem(content, ref)?.t === 'f';

/**
 * One entry per item ref, in the screen's shape: { v, detail, c, other, rows, na, why, files, tt }.
 * @param answers   rows of `answers`
 * @param documents rows of `documents` (item_ref, added_by_tractrac)
 */
export function buildEntries(answers, documents) {
  const out = {};
  const entry = (ref) => (out[ref] ||= {});
  answers.forEach((a) => Object.assign(entry(a.item_ref), a.value || {}, { na: a.not_applicable, why: a.reason || '' }));
  documents.forEach((d) => {
    const e = entry(d.item_ref);
    if (d.added_by_tractrac) e.tt = true;
    else e.files = (e.files || 0) + 1;
  });
  return out;
}

export function isVisible(content, item, entries) {
  const parent = content.COND[item.ref];
  return !parent || (entries[parent] || {}).v === 'Yes';
}

export function isDone(content, item, entries) {
  const e = entries[item.ref] || {};
  if (item.t === 'f') return !!e.tt || (e.na && !!(e.why || '').trim()) || (e.files || 0) > 0;
  if (item.t === 'c') return !!(e.c || []).length;
  if (item.t === 'r') return (e.rows || []).some((r) => (r[0] || '').trim());
  if (item.t === 'y') return !!e.v && !(e.v === 'Yes' && content.DETAIL[item.ref] && !(e.detail || '').trim());
  return !!(e.v || '').toString().trim();
}

/** Required, visible items in sections 1–11 (the checklist section fills itself). */
const counted = (content, entries) =>
  content.ITEMS.filter((i) => i.sec < content.CHECKLIST_SECTION && !content.OPTIONAL[i.ref] && isVisible(content, i, entries));

export const missingItems = (content, entries) => counted(content, entries).filter((i) => !isDone(content, i, entries));

/** % of required items done, as on the vendor's start page. */
export function progressPercent(content, entries) {
  const list = counted(content, entries);
  const done = list.filter((i) => isDone(content, i, entries)).length;
  return list.length ? Math.round((done / list.length) * 100) : 0;
}
