// Uploaded files: stored in UPLOAD_DIR under random names, checked by their contents, and only
// ever sent back through GET /api/documents/:id/file (never served as static files).
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import express from 'express';
import { fileTypeFromFile } from 'file-type';
import multer from 'multer';
import { isStaff, requireUser } from './auth.js';
import { pool } from './db.js';
import { UPLOAD_DIR } from './env.js';
import { ALLOWED_TYPES, MAX_FILE_BYTES } from './rules.js';

export const MAX_FILES_PER_UPLOAD = 10;
/** Content type to send back, by the original file's extension (the contents were checked on upload). */
const DOWNLOAD_TYPES = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/** Multer: random file names, 20 MB each. Types are checked after saving (by contents). */
export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_UPLOAD },
});

export const storedPath = (storedName) => join(UPLOAD_DIR, basename(storedName));

/** Delete stored files, ignoring ones already gone. */
export const removeStored = (names) => Promise.all(names.filter(Boolean).map((n) => unlink(storedPath(n)).catch(() => {})));

/**
 * Check each uploaded file's real type. Returns an error message (and deletes every file of the
 * upload) if any isn't a PDF, DOCX, XLSX, JPG or PNG.
 */
export async function checkTypes(files) {
  for (const f of files) {
    const type = await fileTypeFromFile(f.path);
    if (!type || !ALLOWED_TYPES[type.mime]) {
      await removeStored(files.map((x) => x.filename));
      return `${originalName(f)} isn’t a PDF, DOCX, XLSX, JPG or PNG file.`;
    }
  }
  return null;
}

/** Browsers send file names as UTF-8; multer reads them as Latin-1. Keep a safe display name. */
export function originalName(file) {
  const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
  return basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 200) || 'file';
}

/**
 * Record checked uploads as documents of one item (inside a transaction). Returns their ids.
 * byTractrac: a document TracTrac received itself; it counts as reviewed by the person adding it.
 */
export async function saveUploads(db, { assignmentId, ref, files, userId, byTractrac }) {
  const ids = [];
  for (const f of files) {
    const { rows } = await db.query(
      `INSERT INTO documents (assignment_id, item_ref, file_name, stored_name, size, added_by_tractrac, uploaded_by, reviewed_by, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [assignmentId, ref, originalName(f), f.filename, f.size, byTractrac, userId, byTractrac ? userId : null, byTractrac ? new Date() : null],
    );
    ids.push(rows[0].id);
  }
  return ids;
}

/** Turn multer's errors into friendly 400s. */
export function uploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Each file can be at most 20 MB. Split it by year or compress it.'
        : err.code === 'LIMIT_FILE_COUNT'
          ? `Upload at most ${MAX_FILES_PER_UPLOAD} files at a time.`
          : 'The upload didn’t work. Please try again.';
    return res.status(400).json({ error: message });
  }
  next(err);
}

// ---- Download ------------------------------------------------------------------------------

export const filesRouter = express.Router();

/** The file of one document: for its own organisation, or TracTrac staff. */
filesRouter.get('/:id/file', requireUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Not found' });
  const { rows } = await pool.query(
    `SELECT d.file_name, d.stored_name, a.organisation_id
       FROM documents d JOIN assignments a ON a.id = d.assignment_id
      WHERE d.id = $1`,
    [id],
  );
  const doc = rows[0];
  const allowed = doc && (isStaff(req.user) || req.user.organisation?.id === doc.organisation_id);
  // Same answer for "doesn't exist" and "not yours", so ids can't be probed.
  if (!allowed) return res.status(404).json({ error: 'Not found' });
  if (!doc.stored_name) return res.status(404).json({ error: 'This document has no stored file.' });
  res.set('X-Content-Type-Options', 'nosniff');
  // Stored files have no extension; send the type of the (checked) original, or a plain download.
  const ext = extname(doc.file_name).toLowerCase();
  res.type(DOWNLOAD_TYPES[ext] || 'application/octet-stream');
  res.download(storedPath(doc.stored_name), doc.file_name, { dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File not found' });
  });
});
