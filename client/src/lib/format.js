import { config } from '../config.js';

/** Some ICU versions abbreviate September as "Sept" in en-GB; the designs use "Sep". */
const fixSept = (s) => s.replace(/\bSept\b/, 'Sep');

/** "5 Nov 2026" in the organisation's time zone. */
function formatDate(d) {
  return fixSept(new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: config.timeZone }).format(d));
}

/** "1 document" / "3 documents". */
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** Today's date as "YYYY-MM-DD" in the organisation's time zone. */
export function todayIso(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: config.timeZone }).format(d);
}

/** Parse "YYYY-MM-DD" without day-shifting across time zones. */
const parseIso = (iso) => (iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso));

/** "15 Dec 2026" from an ISO day. */
export const formatDay = (iso) => formatDate(parseIso(iso));

/** "3 Nov" (current year) or "3 Nov 2025". */
export function formatShortDay(iso, today = todayIso()) {
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return fixSept(new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: config.timeZone }).format(parseIso(iso)));
}
