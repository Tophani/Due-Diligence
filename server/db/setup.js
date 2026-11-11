// npm run db:setup — creates the tables in schema.sql (existing tables are left alone).
import { readFileSync } from 'node:fs';
import pg from 'pg';
import '../src/env.js';

const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(sql);
  console.log('Database tables are ready.');
} catch (err) {
  console.error(`Setup failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
