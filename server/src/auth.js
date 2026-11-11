// Sign-in with a one-time email code, and the checks that protect every other route.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { currentCycle } from './cycles.js';
import { pool, transaction } from './db.js';
import { codeEmail, describeMailError, mailConfigured, smtpSummary } from './mail.js';
import { sessionSecret } from './env.js';

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5; // wrong guesses allowed per code
const MAX_CODES_PER_HOUR = 5; // codes one person can request per hour
const SAME_REPLY = { message: 'If that email is registered, we’ve sent a sign-in code to it.' };
const WRONG_CODE = 'That code is wrong or has expired. Check the email, or ask for a new code.';

const secret = sessionSecret();
/** Keyed hash, so a leaked database doesn't reveal codes (only a million are possible). */
const hashCode = (code) => createHmac('sha256', secret).update(code).digest('hex');
const sameHash = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const normaliseEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

/** The signed-in user with their organisation, or null. Read fresh on every request. */
async function loadUser(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, o.id AS org_id, o.name AS org_name
       FROM users u LEFT JOIN organisations o ON o.id = u.organisation_id
      WHERE u.id = $1`,
    [id],
  );
  const u = rows[0];
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, organisation: u.org_id ? { id: u.org_id, name: u.org_name } : null };
}

// ---- Middleware ----------------------------------------------------------------------------

/** 401 unless signed in. Sets req.user. */
export async function requireUser(req, res, next) {
  const user = req.session.userId ? await loadUser(req.session.userId) : null;
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  req.user = user;
  next();
}

/** Vendors only, and only with an organisation. */
export function requireVendor(req, res, next) {
  if (req.user.role !== 'vendor' || !req.user.organisation) return res.status(403).json({ error: 'This is for vendor accounts.' });
  next();
}

export const isStaff = (user) => user.role === 'reviewer' || user.role === 'admin';

/** TracTrac staff only (reviewers and Full access). */
export function requireStaff(req, res, next) {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'This is for TracTrac staff.' });
  next();
}

/** "Full access" staff only (role admin): changing staff and organisations. */
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'You need Full access to do this.' });
  next();
}

// ---- Routes --------------------------------------------------------------------------------

export const authRouter = express.Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A very small in-memory limit per network address (one server process is enough here).
 * Stops anyone hammering the open sign-in and registration routes.
 */
function perAddressLimit(max, minutes) {
  const hits = new Map(); // ip -> [timestamps]
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < minutes * 60_000);
    if (recent.length >= max) {
      signInLog(`${req.method} ${req.originalUrl} from ${req.ip}: refused, too many attempts from this address (limit ${max} per ${minutes} min)`);
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    if (hits.size > 10_000) hits.clear(); // keep memory bounded
    next();
  };
}
const codeLimit = perAddressLimit(20, 15);
const registerLimit = perAddressLimit(5, 60);

/** Sign-in events in the server log (never the code itself unless it's printed as the email). */
function signInLog(message, isError = false) {
  const line = `[sign-in ${new Date().toISOString().slice(11, 19)}] ${message}`;
  if (isError) console.error(line);
  else console.log(line);
}

/**
 * Create a sign-in code and email it. At most 5 per hour per person. The result (sent, or the
 * mail server's full error) goes to the server log; the person always gets the same reply.
 */
async function sendCode(userId, email) {
  const { rows: recent } = await pool.query(`SELECT count(*)::int AS n FROM login_codes WHERE user_id = $1 AND created_at > now() - interval '1 hour'`, [userId]);
  if (recent[0].n >= MAX_CODES_PER_HOUR) {
    signInLog(`${email}: matched user #${userId}, but ${MAX_CODES_PER_HOUR} codes were already sent this hour; no new code sent`);
    return;
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  // Only the newest code works.
  await pool.query('UPDATE login_codes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
  await pool.query(`INSERT INTO login_codes (user_id, code, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`, [userId, hashCode(code), CODE_MINUTES]);
  signInLog(`${email}: matched user #${userId}; code created, emailing it (${mailConfigured ? `SMTP ${smtpSummary()}` : 'SMTP not set up, printing it below'})`);
  // Not awaited: replying before the mail server answers keeps the reply time the same for
  // registered and unknown emails.
  codeEmail(email, code, CODE_MINUTES).then(
    (reply) => signInLog(`${email}: code email ${mailConfigured ? `sent (mail server said: ${reply})` : 'printed above'}`),
    (err) => signInLog(`${email}: code email FAILED: ${describeMailError(err)}`, true),
  );
}

/** Always the same reply, so nobody can find out which emails are registered. */
authRouter.post('/request-code', codeLimit, async (req, res) => {
  const email = normaliseEmail(req.body?.email);
  signInLog(`code requested for "${email || '(no email)'}" from ${req.ip}`);
  const { rows } = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
  if (rows[0]) await sendCode(rows[0].id, email);
  else signInLog(`${email || '(no email)'}: no user with this email; nothing sent`);
  res.json(SAME_REPLY);
});

/**
 * "Register your organisation": creates the organisation and its first user, puts it in the
 * current cycle, and sends a sign-in code. If the email already has an account it just sends a
 * code, with the same reply, so registering can't be used to find out who is registered.
 */
authRouter.post('/register', registerLimit, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = normaliseEmail(req.body?.email);
  const organisationName = String(req.body?.organisationName || '').trim();
  if (!name || !organisationName || !EMAIL.test(email) || name.length > 200 || organisationName.length > 200) {
    return res.status(400).json({ error: 'Enter your name, your work email and your organisation’s name.' });
  }
  const userId = await transaction(async (db) => {
    const { rows: existing } = await db.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (existing[0]) return existing[0].id;
    const { rows: org } = await db.query(`INSERT INTO organisations (name, contact_name, contact_email) VALUES ($1, $2, $3) RETURNING id`, [organisationName, name, email]);
    const { rows: user } = await db.query(`INSERT INTO users (name, email, role, organisation_id) VALUES ($1, $2, 'vendor', $3) RETURNING id`, [name, email, org[0].id]);
    const cycle = await currentCycle(db);
    if (cycle) await db.query('INSERT INTO assignments (cycle_id, organisation_id) VALUES ($1, $2)', [cycle.id, org[0].id]);
    console.log(`\n  [Due Diligence Portal] New organisation registered: ${organisationName} (${name} <${email}>)\n`);
    return user[0].id;
  });
  await sendCode(userId, email);
  res.json(SAME_REPLY);
});

authRouter.post('/verify-code', codeLimit, async (req, res, next) => {
  const email = normaliseEmail(req.body?.email);
  const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s/g, '') : '';
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: WRONG_CODE });

  // Count the attempt first (in one statement), then compare, so parallel guesses can't skip the limit.
  const { rows } = await pool.query(
    `UPDATE login_codes c SET attempts = c.attempts + 1
       FROM users u
      WHERE c.user_id = u.id AND lower(u.email) = $1
        AND c.used_at IS NULL AND c.expires_at > now()
        AND c.id = (SELECT id FROM login_codes WHERE user_id = u.id AND used_at IS NULL ORDER BY created_at DESC LIMIT 1)
      RETURNING c.id, c.code, c.attempts, c.user_id`,
    [email],
  );
  const row = rows[0];
  if (!row || row.attempts > MAX_ATTEMPTS || !sameHash(row.code, hashCode(code))) {
    if (row && row.attempts >= MAX_ATTEMPTS) await pool.query('UPDATE login_codes SET used_at = now() WHERE id = $1', [row.id]);
    return res.status(400).json({ error: WRONG_CODE });
  }
  // Mark it used; if another request got there first, refuse.
  const used = await pool.query('UPDATE login_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL', [row.id]);
  if (!used.rowCount) return res.status(400).json({ error: WRONG_CODE });

  // New session id on sign-in, so an old cookie can't be reused.
  req.session.regenerate(async (err) => {
    if (err) return next(err);
    req.session.userId = row.user_id;
    res.json({ user: await loadUser(row.user_id) });
  });
});

authRouter.get('/me', requireUser, (req, res) => res.json({ user: req.user }));

authRouter.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('tractrac.sid');
    res.json({ ok: true });
  });
});
