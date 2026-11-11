/** DOM id of an item's main control, e.g. "2.1.3" -> "f-2-1-3". */
export const inputIdFor = (ref) => `f-${ref.replace(/\./g, '-')}`;

/** Item types whose title is a <label> for a single control (the rest are labelled groups). */
export const LABELLED_TYPES = new Set(['t', 'l', 'n', 'd', 's']);
