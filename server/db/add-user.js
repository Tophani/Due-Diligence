// npm run user:add -- --name "Full Name" --email someone@example.com --role admin
// npm run user:add -- --name "Full Name" --email someone@vendor.example --role vendor --organisation "Organisation name"
//
// Adds someone who can sign in. Roles: admin (Full access), reviewer, or vendor. A vendor needs
// --organisation: an existing one (matched by name) or a new one, which joins the current cycle.
// Nothing is emailed; tell the person to sign in with their email address.
import { parseArgs } from 'node:util';
import pg from 'pg';
import '../src/env.js';

const ROLES = ['admin', 'reviewer', 'vendor'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let args;
try {
  ({ values: args } = parseArgs({ options: { name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' }, organisation: { type: 'string' } } }));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const name = (args.name || '').trim();
const email = (args.email || '').trim().toLowerCase();
const role = (args.role || '').trim();
const organisation = (args.organisation || '').trim();

const usage =
  'Usage: npm run user:add -- --name "Full Name" --email someone@example.com --role admin|reviewer|vendor [--organisation "Organisation name"]';
if (!name || !EMAIL.test(email) || !ROLES.includes(role)) {
  console.error(usage);
  process.exit(1);
}
if (role === 'vendor' && !organisation) {
  console.error('A vendor needs --organisation "Organisation name".');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query('BEGIN');
  const { rows: taken } = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
  if (taken.length) throw new Error(`${email} already has an account.`);

  let orgId = null;
  let note = '';
  if (role === 'vendor') {
    const { rows: found } = await client.query('SELECT id, name FROM organisations WHERE lower(name) = lower($1)', [organisation]);
    if (found[0]) {
      orgId = found[0].id;
      note = ` (existing organisation "${found[0].name}")`;
    } else {
      const { rows } = await client.query('INSERT INTO organisations (name, contact_name, contact_email) VALUES ($1, $2, $3) RETURNING id', [organisation, name, email]);
      orgId = rows[0].id;
      const { rows: cycle } = await client.query(
        `SELECT id, name FROM cycles WHERE status = 'active' AND opens_on <= current_date ORDER BY deadline_on LIMIT 1`,
      );
      if (cycle[0]) await client.query('INSERT INTO assignments (cycle_id, organisation_id) VALUES ($1, $2)', [cycle[0].id, orgId]);
      note = ` (new organisation "${organisation}"${cycle[0] ? `, added to ${cycle[0].name}` : ', not in any open cycle'})`;
    }
  }
  await client.query('INSERT INTO users (name, email, role, organisation_id) VALUES ($1, $2, $3, $4)', [name, email, role, orgId]);
  await client.query('COMMIT');
  const label = { admin: 'Full access', reviewer: 'Reviewer', vendor: 'Vendor' }[role];
  console.log(`Added ${name} <${email}> as ${label}${note}. They can now sign in with this email address.`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`Couldn't add the user: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
