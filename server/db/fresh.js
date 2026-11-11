// npm run db:fresh            (on the live server: npm run db:fresh -- --force)
//
// Starts the database from nothing: deletes ALL data (organisations, users, answers, documents,
// sessions) and every uploaded file, then loads only:
//   - the published questionnaire (client/src/data/questionnaire.js), and
//   - one open cycle from .env: CYCLE_NAME, CYCLE_OPENS, CYCLE_FIRST_SUBMISSION, CYCLE_DEADLINE.
// Asks you to type DELETE first. With NODE_ENV=production it also needs --force.
// Afterwards, add the first Full access user: npm run create-admin -- --name "..." --email "..."
import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import pg from 'pg';
import { IS_PRODUCTION, UPLOAD_DIR } from '../src/env.js';

const QUESTIONNAIRE = { name: 'Organizational Due Diligence Form', version: '2.0' };
const TABLES = 'session, login_codes, documents, answers, assignments, cycles, questionnaires, users, organisations';
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// ---- Check the settings before touching anything ----
const cycle = {
  name: (process.env.CYCLE_NAME || '').trim(),
  opens: process.env.CYCLE_OPENS || '',
  first: process.env.CYCLE_FIRST_SUBMISSION || '',
  deadline: process.env.CYCLE_DEADLINE || '',
};
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
const missing = [
  !cycle.name && 'CYCLE_NAME',
  !isDate(cycle.opens) && 'CYCLE_OPENS',
  !isDate(cycle.first) && 'CYCLE_FIRST_SUBMISSION',
  !isDate(cycle.deadline) && 'CYCLE_DEADLINE',
].filter(Boolean);
if (missing.length) fail(`Set ${missing.join(', ')} in server/.env first (dates as YYYY-MM-DD). See DEPLOY.md.`);
if (!(cycle.opens < cycle.first && cycle.first < cycle.deadline)) fail('The dates must be in order: CYCLE_OPENS, then CYCLE_FIRST_SUBMISSION, then CYCLE_DEADLINE.');
if (IS_PRODUCTION && !process.argv.includes('--force')) fail('NODE_ENV is production. If you really mean to delete everything, run: npm run db:fresh -- --force');

// ---- Confirm ----
console.log(`\nThis deletes ALL data in the database (organisations, users, answers, documents) and every file in ${UPLOAD_DIR}.`);
console.log(`It then creates the cycle "${cycle.name}" (opens ${cycle.opens}, first documents due ${cycle.first}, deadline ${cycle.deadline}).\n`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question('Type DELETE to confirm: ')).trim();
rl.close();
if (answer !== 'DELETE') fail('Nothing was changed.');

// ---- Start fresh ----
const questionnaire = await import(new URL('../../client/src/data/questionnaire.js', import.meta.url));
const content = Object.fromEntries(Object.entries(questionnaire).filter(([k, v]) => !['RAW', 'BYREF'].includes(k) && typeof v !== 'function'));

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')); // make sure every table is there and up to date
  await client.query('BEGIN');
  await client.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`);
  const { rows } = await client.query(`INSERT INTO questionnaires (name, version, status, content) VALUES ($1, $2, 'published', $3) RETURNING id`, [
    QUESTIONNAIRE.name,
    QUESTIONNAIRE.version,
    JSON.stringify(content),
  ]);
  await client.query(
    `INSERT INTO cycles (name, questionnaire_id, opens_on, first_submission_on, deadline_on, status) VALUES ($1, $2, $3, $4, $5, 'active')`,
    [cycle.name, rows[0].id, cycle.opens, cycle.first, cycle.deadline],
  );
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  await client.end().catch(() => {});
  fail(`Nothing was changed: ${err.message}`);
}
await client.end();

// Uploaded files belonged to the deleted records.
let removed = 0;
try {
  for (const entry of readdirSync(UPLOAD_DIR, { withFileTypes: true })) {
    if (entry.isFile()) {
      unlinkSync(join(UPLOAD_DIR, entry.name));
      removed++;
    }
  }
} catch (err) {
  if (err.code !== 'ENOENT') console.warn(`Couldn't empty ${UPLOAD_DIR}: ${err.message}`);
}

console.log(`\nDone. The database is empty apart from the questionnaire (v${QUESTIONNAIRE.version}) and the cycle "${cycle.name}".`);
console.log(`Removed ${removed} uploaded file${removed === 1 ? '' : 's'}.`);
console.log('Next, add the first Full access user: npm run create-admin -- --name "Your Name" --email you@example.com');
