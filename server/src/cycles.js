import { pool } from './db.js';

/**
 * The cycle everyone works on: the open cycle that has opened, nearest deadline first.
 * (The screens show one cycle at a time.) Null if none is open.
 */
export async function currentCycle(db = pool) {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.first_submission_on, c.deadline_on, q.content
       FROM cycles c JOIN questionnaires q ON q.id = c.questionnaire_id
      WHERE c.status = 'active' AND c.opens_on <= current_date
      ORDER BY c.deadline_on ASC LIMIT 1`,
  );
  return rows[0] || null;
}
