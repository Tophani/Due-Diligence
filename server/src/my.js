// /api/my/... — the signed-in vendor's own assessment. Every query is scoped to the vendor's
// organisation (req.user.organisation.id); ids from the URL are never trusted on their own.
import express from 'express';
import { requireUser, requireVendor } from './auth.js';
import { pool, transaction } from './db.js';
import { submittedEmail } from './mail.js';
import { buildEntries, findItem, isFileItem, missingItems } from './rules.js';
import { checkTypes, removeStored, saveUploads, upload, uploadErrors } from './uploads.js';

export const myRouter = express.Router();
myRouter.use(requireUser, requireVendor);

// What vendors see of a document. `reviewed`: TracTrac has checked it ("Checked by TracTrac"),
// so the vendor can no longer remove it. Who reviewed it, and when, stays with TracTrac.
const DOC_COLUMNS = `id, item_ref, file_name, size, added_by_tractrac, created_at,
                     (stored_name IS NOT NULL) AS has_file,
                     (reviewed_at IS NOT NULL) AS reviewed`;

/**
 * An organisation's current assessment: its open cycle that has opened (nearest deadline first),
 * otherwise its latest cycle (read-only once closed). Null if it has none. Also used by /api/admin.
 */
export async function currentAssessment(orgId, db = pool) {
  const { rows } = await db.query(
    `SELECT a.id, a.submitted_at, a.submission_ref,
            c.id AS cycle_id, c.name AS cycle_name, c.opens_on, c.first_submission_on, c.deadline_on, c.status AS cycle_status,
            q.id AS questionnaire_id, q.name AS questionnaire_name, q.version AS questionnaire_version, q.content
       FROM assignments a
       JOIN cycles c ON c.id = a.cycle_id
       JOIN questionnaires q ON q.id = c.questionnaire_id
      WHERE a.organisation_id = $1 AND c.status <> 'draft' AND c.opens_on <= current_date
      ORDER BY (c.status = 'active') DESC, c.deadline_on ASC
      LIMIT 1`,
    [orgId],
  );
  return rows[0] || null;
}

/** Load the assessment into req.assessment, or 404. */
async function withAssessment(req, res, next) {
  req.assessment = await currentAssessment(req.user.organisation.id);
  if (!req.assessment) return res.status(404).json({ error: 'You don’t have an open assessment.' });
  next();
}

/** Vendors can change their form while the cycle is open and until they submit. */
const editable = (a) => a.cycle_status === 'active' && !a.submitted_at;
const LOCKED = 'This can’t be changed now. Your form has been submitted, or the cycle has closed.';

// ---- GET /api/my/assessment ----------------------------------------------------------------

myRouter.get('/assessment', withAssessment, async (req, res) => {
  const a = req.assessment;
  const [answers, documents] = await Promise.all([
    pool.query('SELECT item_ref, value, not_applicable, reason FROM answers WHERE assignment_id = $1', [a.id]),
    pool.query(`SELECT ${DOC_COLUMNS} FROM documents WHERE assignment_id = $1 ORDER BY created_at, id`, [a.id]),
  ]);
  res.json({
    organisation: req.user.organisation,
    cycle: { id: a.cycle_id, name: a.cycle_name, opensOn: a.opens_on, firstSubmissionOn: a.first_submission_on, deadlineOn: a.deadline_on, status: a.cycle_status },
    questionnaire: { id: a.questionnaire_id, name: a.questionnaire_name, version: a.questionnaire_version, content: a.content },
    submission: a.submitted_at ? { submittedAt: a.submitted_at, reference: a.submission_ref } : null,
    answers: answers.rows,
    documents: documents.rows,
  });
});

// ---- PUT /api/my/answers/:ref ----------------------------------------------------------------

const text = (v, max) => v === undefined || (typeof v === 'string' && v.length <= max);
const strings = (list, maxItems, max) => Array.isArray(list) && list.length <= maxItems && list.every((s) => typeof s === 'string' && s.length <= max);

/** The answer value: only the fields the form uses, within sensible sizes. */
function validValue(value, item) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object' || Array.isArray(value) || item.t === 'f') return false;
  const keys = Object.keys(value);
  if (!keys.every((k) => ['v', 'detail', 'c', 'other', 'rows'].includes(k))) return false;
  return (
    text(value.v, 10_000) &&
    text(value.detail, 10_000) &&
    text(value.other, 1_000) &&
    (value.c === undefined || strings(value.c, 30, 200)) &&
    (value.rows === undefined || (Array.isArray(value.rows) && value.rows.length <= 100 && value.rows.every((r) => strings(r, 10, 1_000))))
  );
}

myRouter.put('/answers/:ref', withAssessment, async (req, res) => {
  const a = req.assessment;
  const item = findItem(a.content, req.params.ref);
  if (!item) return res.status(404).json({ error: 'There’s no question with that number.' });
  const { value = null, notApplicable = false, reason = null } = req.body || {};
  if (!validValue(value, item) || typeof notApplicable !== 'boolean' || !(reason === null || (typeof reason === 'string' && reason.length <= 2_000))) {
    return res.status(400).json({ error: 'That answer isn’t in the expected format.' });
  }
  if (!editable(a)) return res.status(409).json({ error: LOCKED });

  const stored = value && Object.keys(value).length ? JSON.stringify(value) : null;
  await pool.query(
    `INSERT INTO answers (assignment_id, item_ref, value, not_applicable, reason) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (assignment_id, item_ref) DO UPDATE SET value = EXCLUDED.value, not_applicable = EXCLUDED.not_applicable, reason = EXCLUDED.reason`,
    [a.id, item.ref, stored, notApplicable, notApplicable ? reason : null],
  );
  res.json({ ok: true });
});

// ---- POST /api/my/documents/:ref -----------------------------------------------------------

/** Check the item and the lock before accepting any file. */
function canUpload(req, res, next) {
  if (!isFileItem(req.assessment.content, req.params.ref)) return res.status(404).json({ error: 'That question doesn’t take documents.' });
  if (!editable(req.assessment)) return res.status(409).json({ error: LOCKED });
  next();
}

myRouter.post('/documents/:ref', withAssessment, canUpload, upload.array('files'), uploadErrors, async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Choose a file to upload.' });
  const typeError = await checkTypes(files);
  if (typeError) return res.status(400).json({ error: typeError });

  const ids = await transaction(async (db) => {
    // Re-check inside the transaction: the form may have been submitted meanwhile.
    const { rows } = await db.query('SELECT submitted_at FROM assignments WHERE id = $1 FOR UPDATE', [req.assessment.id]);
    if (rows[0].submitted_at) return null;
    const saved = await saveUploads(db, { assignmentId: req.assessment.id, ref: req.params.ref, files, userId: req.user.id, byTractrac: false });
    // A document was given, so the item no longer "doesn't apply".
    await db.query(`UPDATE answers SET not_applicable = false, reason = NULL WHERE assignment_id = $1 AND item_ref = $2`, [req.assessment.id, req.params.ref]);
    return saved;
  });
  if (!ids) {
    await removeStored(files.map((f) => f.filename));
    return res.status(409).json({ error: LOCKED });
  }
  const { rows } = await pool.query(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = ANY($1) ORDER BY id`, [ids]);
  res.status(201).json({ documents: rows });
});

// ---- DELETE /api/my/documents/:id ------------------------------------------------------------

/** Only the vendor's own uploads that TracTrac hasn't marked as reviewed. */
myRouter.delete('/documents/:id', withAssessment, async (req, res) => {
  const a = req.assessment;
  const id = Number(req.params.id);
  const { rows } = await pool.query(`SELECT id, stored_name, added_by_tractrac, reviewed_at FROM documents WHERE id = $1 AND assignment_id = $2`, [
    Number.isInteger(id) ? id : -1,
    a.id,
  ]);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (doc.added_by_tractrac || doc.reviewed_at) {
    return res.status(409).json({ error: 'TracTrac has already reviewed this document, so it can’t be removed.' });
  }
  if (!editable(a)) return res.status(409).json({ error: LOCKED });
  const del = await pool.query(`DELETE FROM documents WHERE id = $1 AND reviewed_at IS NULL`, [doc.id]);
  if (!del.rowCount) return res.status(409).json({ error: 'TracTrac has already reviewed this document, so it can’t be removed.' });
  await removeStored([doc.stored_name]);
  res.json({ ok: true });
});

// ---- POST /api/my/submit --------------------------------------------------------------------

myRouter.post('/submit', withAssessment, async (req, res) => {
  if (req.body?.declaration !== true) return res.status(400).json({ error: 'Tick the declaration to submit.' });
  const orgId = req.user.organisation.id;

  const result = await transaction(async (db) => {
    const a = await currentAssessment(orgId, db);
    if (!a) return { status: 404, body: { error: 'You don’t have an open assessment.' } };
    // Lock the cycle and this assignment so two submissions can't take the same reference.
    await db.query('SELECT id FROM cycles WHERE id = $1 FOR UPDATE', [a.cycle_id]);
    const { rows: fresh } = await db.query('SELECT submitted_at FROM assignments WHERE id = $1 FOR UPDATE', [a.id]);
    if (fresh[0].submitted_at) return { status: 409, body: { error: 'This form has already been submitted.' } };
    if (a.cycle_status !== 'active') return { status: 409, body: { error: 'This cycle has closed.' } };

    const [answers, documents] = await Promise.all([
      db.query('SELECT item_ref, value, not_applicable, reason FROM answers WHERE assignment_id = $1', [a.id]),
      db.query('SELECT item_ref, added_by_tractrac FROM documents WHERE assignment_id = $1', [a.id]),
    ]);
    const missing = missingItems(a.content, buildEntries(answers.rows, documents.rows));
    if (missing.length) {
      return {
        status: 409,
        body: { error: `${missing.length} required ${missing.length === 1 ? 'item is' : 'items are'} not done yet.`, missing: missing.map((i) => i.ref) },
      };
    }

    // Reference: TDD-{year}-C{cycle}-{sequence}, continuing any references already in this cycle.
    const { rows: refs } = await db.query('SELECT submission_ref FROM assignments WHERE cycle_id = $1 AND submission_ref IS NOT NULL', [a.cycle_id]);
    const prefix = refs[0]?.submission_ref.replace(/-\d+$/, '') || `TDD-${a.opens_on.slice(0, 4)}-C${a.cycle_id}`;
    const next = Math.max(0, ...refs.map((r) => Number(r.submission_ref.split('-').pop()) || 0)) + 1;
    const reference = `${prefix}-${String(next).padStart(4, '0')}`;
    const { rows } = await db.query(`UPDATE assignments SET submitted_at = now(), submission_ref = $2 WHERE id = $1 RETURNING submitted_at`, [a.id, reference]);
    return { status: 200, body: { submission: { submittedAt: rows[0].submitted_at, reference } } };
  });
  if (result.status === 200) {
    // The submission is saved either way; a failed confirmation email is only logged.
    submittedEmail({ to: req.user.email, name: req.user.name, organisation: req.user.organisation.name, reference: result.body.submission.reference }).catch((err) =>
      console.error(`Submission email to ${req.user.email} failed: ${err.message}`),
    );
  }
  res.status(result.status).json(result.body);
});
