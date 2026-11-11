import { existsSync, mkdirSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import { adminRouter } from './admin.js';
import { authRouter } from './auth.js';
import { pool } from './db.js';
import { APP_URL, CLIENT_DIST, ENV_FILE, IS_PRODUCTION, PORT, sessionSecret, UPLOAD_DIR } from './env.js';
import { describeMailError, mailConfigured, smtpSummary, verifySmtp } from './mail.js';
import { myRouter } from './my.js';
import { filesRouter } from './uploads.js';

// ---- Checks before starting ------------------------------------------------------------------

/** Is `child` the same folder as `parent`, or inside it? */
const inside = (child, parent) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};
if (inside(UPLOAD_DIR, CLIENT_DIST) || inside(CLIENT_DIST, UPLOAD_DIR)) {
  console.error(`UPLOAD_DIR (${UPLOAD_DIR}) is inside the public web folder. Choose a folder outside ${CLIENT_DIST}.`);
  process.exit(1);
}
if (IS_PRODUCTION && !existsSync(join(CLIENT_DIST, 'index.html'))) {
  console.error('The web app hasn’t been built. Run "npm run build" first (see DEPLOY.md).');
  process.exit(1);
}
// Email: say which SMTP server is used (never the password), then check the login in the background.
console.log(`Settings: ${ENV_FILE}${existsSync(ENV_FILE) ? '' : ' (NOT FOUND)'}`);
if (mailConfigured) {
  console.log(`Email: SMTP ${smtpSummary()}`);
  verifySmtp().then((err) =>
    console[err ? 'error' : 'log'](
      err ? `Email: SMTP login FAILED, so no emails can be sent: ${describeMailError(err)}` : 'Email: SMTP login OK',
    ),
  );
} else {
  console[IS_PRODUCTION ? 'warn' : 'log'](
    `${IS_PRODUCTION ? 'WARNING: ' : ''}Email: SMTP isn’t set up (SMTP_HOST is empty), so emails, including sign-in codes, are printed in this log.`,
  );
}
if (IS_PRODUCTION && !APP_URL.startsWith('https://')) {
  console.warn(`WARNING: APP_URL is ${APP_URL}. In production the portal must be reached over https, or sign-in cookies won't be sent.`);
}

mkdirSync(UPLOAD_DIR, { recursive: true }); // uploaded files live here; they are never served as static files

// ---- App ---------------------------------------------------------------------------------------

const app = express();
app.disable('x-powered-by');
if (IS_PRODUCTION) app.set('trust proxy', 1); // behind one HTTPS proxy (e.g. Caddy or nginx): needed for secure cookies

// Security headers on every response.
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  if (IS_PRODUCTION) {
    res.set({
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      'Strict-Transport-Security': 'max-age=31536000',
    });
  }
  next();
});

// In development the React app runs on Vite (another port) and calls the API through its proxy.
// In production the same server serves both, so no cross-origin access is allowed at all.
if (!IS_PRODUCTION) app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '200kb' }));

// Sessions live in PostgreSQL (table "session"). The cookie is httpOnly (page scripts can't read
// it), SameSite=Lax (not sent on cross-site form posts) and, in production, Secure (https only).
const PgStore = connectPgSimple(session);
app.use(
  session({
    name: 'tractrac.sid',
    store: new PgStore({ pool, tableName: 'session' }),
    secret: sessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: IS_PRODUCTION,
    cookie: { httpOnly: true, sameSite: 'lax', secure: IS_PRODUCTION, maxAge: 8 * 60 * 60 * 1000 },
  }),
);

// Changes must come from our own pages: they send this header, which a plain form on another
// site can't, and a cross-site script can't either without passing CORS.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.get('X-Requested-With') === 'TracTrac') return next();
  res.status(403).json({ error: 'Request refused.' });
});

/** Is the server up, and can it reach the database? */
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  } catch (err) {
    console.error('Health check: database unreachable:', err.message);
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/my', myRouter);
app.use('/api/admin', adminRouter);
app.use('/api/documents', filesRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Production: the built React app. Hashed files in /assets can be cached for a long time;
// every other page address gets index.html (the app's own router takes it from there).
if (IS_PRODUCTION) {
  app.use('/assets', express.static(join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  });
}

// Anything unexpected: log it, tell the client nothing internal.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request isn’t valid JSON.' });
  if (err.status === 404 || err.statusCode === 404) return res.status(404).send('Not found');
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

app.listen(PORT, () =>
  console.log(
    IS_PRODUCTION
      ? `Due Diligence Portal running on http://localhost:${PORT} (public address ${APP_URL})`
      : `Due Diligence Portal API listening on http://localhost:${PORT}`,
  ),
);
