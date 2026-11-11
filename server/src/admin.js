// /api/admin/... — TracTrac staff only. Vendors get 403 on every route here.
import { createReadStream, existsSync } from 'node:fs';
import { ZipArchive } from 'archiver';
import express from 'express';
import { requireAdmin, requireStaff, requireUser } from './auth.js';
import { currentCycle } from './cycles.js';
import { pool, transaction } from './db.js';
import { organisationInvite, reminderEmail, staffInvite } from './mail.js';
import { currentAssessment } from './my.js';
import { buildEntries, isFileItem, progressPercent } from './rules.js';
import { checkTypes, removeStored, saveUploads, storedPath, upload, uploadErrors } from './uploads.js';

export const adminRouter = express.Router();
adminRouter.use(requireUser, requireStaff);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF_ROLES = ['reviewer', 'admin'];
const idParam = (v) => (/^\d+$/.test(v) ? Number(v) : -1);

/** "15 December 2026" for emails. */
const longDay = (iso) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/** Send an invitation; the account exists either way, so a failed email is reported, not fatal. */
async function tryInvite(send, email) {
  try {
    await send();
    return true;
  } catch (err) {
    console.error(`Invitation to ${email} failed: ${err.message}`);
    return false;
  }
}

/** A document as staff see it. */
const DOC_SELECT = `
  SELECT d.id, d.item_ref, d.file_name, d.size, d.added_by_tractrac, d.created_at, d.reviewed_at,
         (d.stored_name IS NOT NULL) AS has_file, up.name AS uploaded_by, rv.name AS reviewed_by
    FROM documents d
    LEFT JOIN users up ON up.id = d.uploaded_by
    LEFT JOIN users rv ON rv.id = d.reviewed_by`;
const docJson = (d) => ({
  id: d.id,
  itemRef: d.item_ref,
  fileName: d.file_name,
  size: d.size,
  addedByTractrac: d.added_by_tractrac,
  uploadedBy: d.uploaded_by,
  createdAt: d.created_at,
  hasFile: d.has_file,
  reviewedBy: d.reviewed_by,
  reviewedAt: d.reviewed_at,
});

// ---- Home ------------------------------------------------------------------------------------

/** Every organisation in the current cycle with its progress and document counts. */
adminRouter.get('/overview', async (req, res) => {
  const cycle = await currentCycle();
  if (!cycle) return res.json({ cycle: null, organisations: [] });
  const { rows: assignments } = await pool.query(
    `SELECT a.id, a.submitted_at, o.id AS org_id, o.name, o.contact_name, o.contact_email
       FROM assignments a JOIN organisations o ON o.id = a.organisation_id
      WHERE a.cycle_id = $1 ORDER BY o.name`,
    [cycle.id],
  );
  const ids = assignments.map((a) => a.id);
  const [answers, documents] = await Promise.all([
    pool.query('SELECT assignment_id, item_ref, value, not_applicable, reason FROM answers WHERE assignment_id = ANY($1)', [ids]),
    pool.query('SELECT assignment_id, item_ref, added_by_tractrac, reviewed_at, created_at FROM documents WHERE assignment_id = ANY($1)', [ids]),
  ]);
  const of = (rows, id) => rows.filter((r) => r.assignment_id === id);
  res.json({
    cycle: { id: cycle.id, name: cycle.name, firstSubmissionOn: cycle.first_submission_on, deadlineOn: cycle.deadline_on },
    organisations: assignments.map((a) => {
      const docs = of(documents.rows, a.id);
      return {
        id: a.org_id,
        name: a.name,
        contactName: a.contact_name,
        contactEmail: a.contact_email,
        progress: progressPercent(cycle.content, buildEntries(of(answers.rows, a.id), docs)),
        filesUploaded: docs.length,
        notReviewed: docs.filter((d) => !d.reviewed_at).length,
        lastUploadAt: docs.reduce((last, d) => (!last || d.created_at > last ? d.created_at : last), null),
        submittedAt: a.submitted_at,
      };
    }),
  });
});

/** "Send reminder": emails the organisation's contact. */
adminRouter.post('/organisations/:id/reminder', async (req, res) => {
  const { rows } = await pool.query('SELECT name, contact_name, contact_email FROM organisations WHERE id = $1', [idParam(req.params.id)]);
  const org = rows[0];
  if (!org) return res.status(404).json({ error: 'Not found' });
  if (!org.contact_email) return res.status(400).json({ error: 'This organisation has no contact email.' });
  const cycle = await currentCycle();
  try {
    await reminderEmail({ to: org.contact_email, name: org.contact_name, organisation: org.name, deadline: cycle && longDay(cycle.deadline_on) });
  } catch (err) {
    console.error(`Reminder to ${org.contact_email} failed: ${err.message}`);
    return res.status(502).json({ error: 'The reminder couldn’t be emailed. Please try again later.' });
  }
  res.json({ message: `Reminder sent to ${org.contact_name || org.contact_email}` });
});

// ---- Organisation page ---------------------------------------------------------------------

/** Load the organisation and its current assessment into req.org / req.assessment, or 404. */
async function withOrganisation(req, res, next) {
  const { rows } = await pool.query(
    'SELECT id, name, reg_number, contact_name, contact_email, address, notes FROM organisations WHERE id = $1',
    [idParam(req.params.id)],
  );
  req.org = rows[0];
  if (!req.org) return res.status(404).json({ error: 'Not found' });
  req.assessment = await currentAssessment(req.org.id);
  next();
}

adminRouter.get('/organisations/:id', withOrganisation, async (req, res) => {
  const o = req.org;
  const a = req.assessment;
  const organisation = { id: o.id, name: o.name, regNumber: o.reg_number, contactName: o.contact_name, contactEmail: o.contact_email, address: o.address, notes: o.notes };
  if (!a) return res.json({ organisation, assessment: null, documents: [] });
  const [answers, documents] = await Promise.all([
    pool.query('SELECT item_ref, value, not_applicable, reason FROM answers WHERE assignment_id = $1', [a.id]),
    pool.query(`${DOC_SELECT} WHERE d.assignment_id = $1 ORDER BY d.created_at, d.id`, [a.id]),
  ]);
  res.json({
    organisation,
    assessment: {
      cycleName: a.cycle_name,
      firstSubmissionOn: a.first_submission_on,
      deadlineOn: a.deadline_on,
      submittedAt: a.submitted_at,
      submissionRef: a.submission_ref,
      progress: progressPercent(a.content, buildEntries(answers.rows, documents.rows)),
      notApplicable: answers.rows.filter((r) => r.not_applicable).map((r) => ({ ref: r.item_ref, reason: r.reason })),
    },
    documents: documents.rows.map(docJson),
  });
});

/** All of the organisation's files in one ZIP: a folder per section, files named "2.1.3 – Name.pdf". */
adminRouter.get('/organisations/:id/files.zip', withOrganisation, async (req, res) => {
  const a = req.assessment;
  const { rows: all } = a
    ? await pool.query(`SELECT item_ref, file_name, stored_name FROM documents WHERE assignment_id = $1 AND stored_name IS NOT NULL ORDER BY item_ref, id`, [a.id])
    : { rows: [] };
  const rows = all.filter((d) => existsSync(storedPath(d.stored_name))); // skip any file missing from disk
  if (!rows.length) return res.status(404).json({ error: 'This organisation has no files to download yet.' });

  const clean = (s) => s.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').trim();
  const titles = a.content.SECS || [];
  const used = new Set();
  const zip = new ZipArchive({ zlib: { level: 6 } });
  zip.on('warning', (err) => console.warn('ZIP:', err.message));
  zip.on('error', (err) => {
    console.error('ZIP failed:', err);
    res.destroy(err);
  });
  res.attachment(`${clean(req.org.name)} – files.zip`);
  zip.pipe(res);
  for (const d of rows) {
    const sec = Number(d.item_ref.split('.')[0]);
    const folder = `${String(sec).padStart(2, '0')} ${clean(titles[sec - 1] || `Section ${sec}`)}`;
    let name = `${folder}/${d.item_ref} – ${clean(d.file_name)}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${folder}/${d.item_ref} – (${n}) ${clean(d.file_name)}`;
    used.add(name.toLowerCase());
    zip.append(createReadStream(storedPath(d.stored_name)), { name });
  }
  await zip.finalize();
});

/** A document TracTrac received outside the portal (e.g. by email). Same upload rules as vendors. */
function canAddFile(req, res, next) {
  if (!req.assessment) return res.status(409).json({ error: 'This organisation isn’t in an open cycle.' });
  if (!isFileItem(req.assessment.content, req.params.ref)) return res.status(404).json({ error: 'That question doesn’t take documents.' });
  next();
}

adminRouter.post('/organisations/:id/documents/:ref', withOrganisation, canAddFile, upload.array('files'), uploadErrors, async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Choose a file to upload.' });
  const typeError = await checkTypes(files);
  if (typeError) return res.status(400).json({ error: typeError });
  let ids;
  try {
    ids = await transaction((db) => saveUploads(db, { assignmentId: req.assessment.id, ref: req.params.ref, files, userId: req.user.id, byTractrac: true }));
  } catch (err) {
    await removeStored(files.map((f) => f.filename));
    throw err;
  }
  const { rows } = await pool.query(`${DOC_SELECT} WHERE d.id = ANY($1) ORDER BY d.id`, [ids]);
  res.status(201).json({ documents: rows.map(docJson) });
});

/**
 * Mark an item as reviewed (POST) or undo that (DELETE): all of the organisation's files for
 * that item at once. A file uploaded afterwards starts as "not yet reviewed" again.
 */
async function setItemReviewed(req, res, reviewed) {
  const a = req.assessment;
  if (!a || !isFileItem(a.content, req.params.ref)) return res.status(404).json({ error: 'Not found' });
  const { rowCount } = await pool.query(
    reviewed
      ? 'UPDATE documents SET reviewed_by = $3, reviewed_at = now() WHERE assignment_id = $1 AND item_ref = $2 AND reviewed_at IS NULL'
      : 'UPDATE documents SET reviewed_by = NULL, reviewed_at = NULL WHERE assignment_id = $1 AND item_ref = $2',
    reviewed ? [a.id, req.params.ref, req.user.id] : [a.id, req.params.ref],
  );
  const { rows } = await pool.query(`${DOC_SELECT} WHERE d.assignment_id = $1 AND d.item_ref = $2 ORDER BY d.created_at, d.id`, [a.id, req.params.ref]);
  if (!rows.length) return res.status(404).json({ error: 'There are no files for this item yet.' });
  res.json({ changed: rowCount, documents: rows.map(docJson) });
}
adminRouter.post('/organisations/:id/items/:ref/reviewed', withOrganisation, (req, res) => setItemReviewed(req, res, true));
adminRouter.delete('/organisations/:id/items/:ref/reviewed', withOrganisation, (req, res) => setItemReviewed(req, res, false));

// ---- Setup: staff ----------------------------------------------------------------------------

adminRouter.get('/staff', async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name, email, role FROM users WHERE role = ANY($1) ORDER BY name`, [STAFF_ROLES]);
  res.json({ staff: rows });
});

adminRouter.post('/staff', requireAdmin, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = req.body?.role;
  if (!name || name.length > 200 || !EMAIL.test(email) || !STAFF_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Enter a name, a valid email and a role.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id, name, email, role`,
    [name, email, role],
  );
  if (!rows.length) return res.status(409).json({ error: 'Someone with that email already has an account.' });
  const invitationSent = await tryInvite(() => staffInvite({ to: email, name, role }), email);
  res.status(201).json({ member: rows[0], invitationSent });
});

adminRouter.put('/staff/:id', requireAdmin, async (req, res) => {
  const role = req.body?.role;
  if (!STAFF_ROLES.includes(role)) return res.status(400).json({ error: 'Choose Reviewer or Full access.' });
  const result = await transaction(async (db) => {
    const { rows: admins } = await db.query(`SELECT id FROM users WHERE role = 'admin' FOR UPDATE`);
    const id = idParam(req.params.id);
    if (role !== 'admin' && admins.length === 1 && admins[0].id === id) return { status: 409, body: { error: 'Someone must keep Full access.' } };
    const { rows } = await db.query(`UPDATE users SET role = $2 WHERE id = $1 AND role = ANY($3) RETURNING id, name, email, role`, [id, role, STAFF_ROLES]);
    return rows.length ? { status: 200, body: { member: rows[0] } } : { status: 404, body: { error: 'Not found' } };
  });
  res.status(result.status).json(result.body);
});

// ---- Setup: organisations --------------------------------------------------------------------

adminRouter.get('/organisations', async (req, res) => {
  const cycle = await currentCycle();
  const { rows } = await pool.query(
    `SELECT o.id, o.name, o.contact_name, o.contact_email,
            EXISTS (SELECT 1 FROM assignments a WHERE a.organisation_id = o.id AND a.cycle_id = $1) AS in_cycle,
            -- "Active" once anyone from the organisation has signed in (used a sign-in code).
            EXISTS (SELECT 1 FROM users u JOIN login_codes l ON l.user_id = u.id
                     WHERE u.organisation_id = o.id AND l.used_at IS NOT NULL AND l.attempts > 0) AS active
       FROM organisations o ORDER BY o.name`,
    [cycle?.id ?? -1],
  );
  res.json({
    cycle: cycle && { id: cycle.id, name: cycle.name },
    organisations: rows.map((o) => ({ id: o.id, name: o.name, contactName: o.contact_name, contactEmail: o.contact_email, inCycle: o.in_cycle, active: o.active })),
  });
});

/** Add an organisation and its first user (a vendor), and put it in the current cycle. */
adminRouter.post('/organisations', requireAdmin, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const contactName = String(req.body?.contactName || '').trim();
  const contactEmail = String(req.body?.contactEmail || '').trim().toLowerCase();
  if (!name || !contactName || !EMAIL.test(contactEmail) || name.length > 200 || contactName.length > 200) {
    return res.status(400).json({ error: 'Enter the organisation’s name, and its first user’s name and a valid email.' });
  }
  const result = await transaction(async (db) => {
    const { rows: taken } = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [contactEmail]);
    if (taken.length) return { status: 409, body: { error: 'Someone with that email already has an account.' } };
    const { rows } = await db.query(`INSERT INTO organisations (name, contact_name, contact_email) VALUES ($1, $2, $3) RETURNING id, name`, [name, contactName, contactEmail]);
    const org = rows[0];
    await db.query(`INSERT INTO users (name, email, role, organisation_id) VALUES ($1, $2, 'vendor', $3)`, [contactName, contactEmail, org.id]);
    const cycle = await currentCycle(db);
    if (cycle) await db.query('INSERT INTO assignments (cycle_id, organisation_id) VALUES ($1, $2)', [cycle.id, org.id]);
    return { status: 201, body: { organisation: { ...org, inCycle: !!cycle }, cycleName: cycle?.name || null } };
  });
  if (result.status === 201) {
    result.body.invitationSent = await tryInvite(() => organisationInvite({ to: contactEmail, name: contactName, organisation: name }), contactEmail);
  }
  res.status(result.status).json(result.body);
});
