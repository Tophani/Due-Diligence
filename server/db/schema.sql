-- TracTrac due diligence portal: the whole database.
-- Safe to run more than once: existing tables (and their data) are kept, and older databases
-- are brought up to date (see "Upgrades" at the end).
--
-- How far a vendor has got is worked out from answers and documents (not stored).
-- TracTrac's only judgement stored here is whether each document has been reviewed.

-- Vendor organisations.
CREATE TABLE IF NOT EXISTS organisations (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  reg_number    text,
  contact_name  text,
  contact_email text,
  address       text,
  notes         text            -- TracTrac staff only
);

-- Everyone who can sign in. Vendors belong to an organisation; TracTrac staff don't.
-- Staff roles: reviewer, or admin ("Full access": can also change staff and organisations).
CREATE TABLE IF NOT EXISTS users (
  id              serial PRIMARY KEY,
  email           text NOT NULL UNIQUE,
  name            text NOT NULL,
  role            text NOT NULL CHECK (role IN ('vendor', 'reviewer', 'admin')),
  organisation_id integer REFERENCES organisations (id),
  CHECK ((role = 'vendor') = (organisation_id IS NOT NULL))
);

-- One-time sign-in codes sent by email. `code` holds a keyed hash, never the code itself.
CREATE TABLE IF NOT EXISTS login_codes (
  id         serial PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Signed-in sessions (the table connect-pg-simple expects).
CREATE TABLE IF NOT EXISTS session (
  sid    varchar NOT NULL PRIMARY KEY,
  sess   json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON session (expire);

-- Questionnaire versions. `content` holds the whole questionnaire (sections, items, rules)
-- as in client/src/data/questionnaire.js.
CREATE TABLE IF NOT EXISTS questionnaires (
  id      serial PRIMARY KEY,
  name    text NOT NULL,
  version text NOT NULL,
  status  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  content jsonb NOT NULL,
  UNIQUE (name, version)
);

-- Assessment cycles.
CREATE TABLE IF NOT EXISTS cycles (
  id                  serial PRIMARY KEY,
  name                text NOT NULL,
  questionnaire_id    integer NOT NULL REFERENCES questionnaires (id),
  opens_on            date NOT NULL,
  first_submission_on date NOT NULL,
  deadline_on         date NOT NULL,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived'))
);

-- An organisation taking part in a cycle, and its submission.
CREATE TABLE IF NOT EXISTS assignments (
  id              serial PRIMARY KEY,
  cycle_id        integer NOT NULL REFERENCES cycles (id),
  organisation_id integer NOT NULL REFERENCES organisations (id),
  submitted_at    timestamptz,
  submission_ref  text UNIQUE,
  UNIQUE (cycle_id, organisation_id)
);

-- A vendor's answer to one question.
CREATE TABLE IF NOT EXISTS answers (
  id             serial PRIMARY KEY,
  assignment_id  integer NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  item_ref       text NOT NULL,
  value          jsonb,            -- e.g. {"v": "Yes", "detail": "…"}, {"c": ["Nonprofit"]}, {"rows": [[…]]}
  not_applicable boolean NOT NULL DEFAULT false,
  reason         text,             -- why it doesn't apply
  UNIQUE (assignment_id, item_ref)
);

-- Uploaded files. stored_name is the file's name in UPLOAD_DIR. A document is "reviewed" once a
-- staff member marks it (reviewed_by + reviewed_at); after that the vendor can't remove it.
CREATE TABLE IF NOT EXISTS documents (
  id                serial PRIMARY KEY,
  assignment_id     integer NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  item_ref          text NOT NULL,
  file_name         text NOT NULL,
  stored_name       text,          -- empty for the sample documents, which have no file on disk
  size              integer,       -- bytes
  added_by_tractrac boolean NOT NULL DEFAULT false,
  uploaded_by       integer REFERENCES users (id),
  reviewed_by       integer REFERENCES users (id),
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_assignment_idx ON documents (assignment_id);

-- ---- Upgrades for databases created by earlier versions of this file -----------------------

ALTER TABLE login_codes ADD COLUMN IF NOT EXISTS used_at    timestamptz;
ALTER TABLE login_codes ADD COLUMN IF NOT EXISTS attempts   integer NOT NULL DEFAULT 0;
ALTER TABLE login_codes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS login_codes_user_idx ON login_codes (user_id, created_at);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by integer REFERENCES users (id);

-- Review statuses were replaced by "reviewed or not": only approved documents count as reviewed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'review_status') THEN
    UPDATE documents SET reviewed_by = NULL, reviewed_at = NULL WHERE review_status <> 'approved';
    UPDATE documents SET reviewed_at = now() WHERE review_status = 'approved' AND reviewed_at IS NULL;
  END IF;
END $$;
ALTER TABLE documents DROP COLUMN IF EXISTS review_status;
ALTER TABLE documents DROP COLUMN IF EXISTS review_message;

-- The final decision was removed.
ALTER TABLE assignments DROP COLUMN IF EXISTS outcome;
ALTER TABLE assignments DROP COLUMN IF EXISTS outcome_conditions;
