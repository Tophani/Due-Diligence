// Loads server/.env, whichever folder the server or a script is started from.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** Always server/.env, found from this file's location, so it doesn't matter where the server is started from. */
export const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
dotenv.config({ path: ENV_FILE, quiet: true });

function required(name, help) {
  if (!process.env[name]) {
    console.error(`${name} is not set. ${help} (see DEPLOY.md).`);
    process.exit(1);
  }
  return process.env[name];
}

export const DATABASE_URL = required('DATABASE_URL', 'Copy server/.env.example to server/.env and fill it in');
export const PORT = Number(process.env.PORT) || 4000;
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Relative paths are taken from the server folder.
export const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));
export const UPLOAD_DIR = resolve(SERVER_DIR, process.env.UPLOAD_DIR || './uploads');
/** The built React app (npm run build), served by this server in production. */
export const CLIENT_DIST = resolve(SERVER_DIR, '../client/dist');

/** The portal's public address, for links in emails, e.g. https://dd.tractrac.example. */
export const APP_URL = (process.env.APP_URL || (IS_PRODUCTION ? `http://localhost:${PORT}` : 'http://localhost:5173')).replace(/\/+$/, '');

/** Email (SMTP). If SMTP_HOST isn't set, emails are printed in the terminal instead. */
export const SMTP = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || '',
};
if (SMTP.host && !SMTP.from) {
  console.error('MAIL_FROM is not set. Add the sender address, e.g. MAIL_FROM="Due Diligence Portal <no-reply@example.com>" (see DEPLOY.md).');
  process.exit(1);
}

/** Signs session cookies and hashes sign-in codes. Only the server needs it (not the db scripts). */
export function sessionSecret() {
  const secret = required('SESSION_SECRET', 'Add a long random SESSION_SECRET to server/.env');
  if (secret.length < 32) {
    console.error('SESSION_SECRET must be at least 32 characters (see DEPLOY.md).');
    process.exit(1);
  }
  return secret;
}
