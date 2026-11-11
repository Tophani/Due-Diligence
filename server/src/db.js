import pg from 'pg';
import { DATABASE_URL } from './env.js';

// Return DATE columns as "YYYY-MM-DD" text. By default pg makes them local-midnight Date
// objects, which can shift by a day when sent as JSON.
pg.types.setTypeParser(1082, (value) => value);

/** One shared connection pool for the whole server. */
export const pool = new pg.Pool({ connectionString: DATABASE_URL });

/** Run fn(client) in a transaction; rolls back if it throws. */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
