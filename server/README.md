# Due Diligence Portal: server

A small Express server and a PostgreSQL database for the Due Diligence Portal
(TracTrac Mechanization Services Limited). It signs people in with an emailed code and serves
both the vendor and the staff side. To run it on a real server, follow **[DEPLOY.md](../DEPLOY.md)**.

## Running it on your own computer

You need Node.js 20.6+ and PostgreSQL. In the `tractrac-design-handoff` folder:

1. `npm run install:all`
2. Create an empty database, e.g. `psql -U postgres -c "CREATE DATABASE tractrac"`
   (Windows: `"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE tractrac"`).
3. Copy `server/.env.example` to `server/.env` and fill it in (database password, `SESSION_SECRET`,
   and the four `CYCLE_*` dates). Leave `NODE_ENV=development` and `SMTP_HOST` empty.
4. `npm run db:fresh` and type `DELETE`: creates the tables, the questionnaire and the cycle.
5. `npm run create-admin -- --name "Your Name" --email you@example.com`
6. `npm run dev`, then open http://localhost:5173 and sign in with that email.

With `SMTP_HOST` empty, every email (including your sign-in code) is printed in the terminal,
in the `[server]` lines.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Website (Vite) and server together, reloading on changes |
| `npm run build` / `npm start` | Build the website, then run everything from one server (production) |
| `npm run db:setup` | Creates missing tables and brings an older database up to date (keeps data) |
| `npm run db:fresh` | **Deletes everything** (data and uploaded files), then loads the questionnaire and the cycle from `.env`. Asks you to type DELETE; needs `-- --force` when `NODE_ENV=production` |
| `npm run create-admin -- --name "…" --email "…"` | Adds a Full access user |
| `npm run user:add -- --name "…" --email "…" --role admin\|reviewer\|vendor [--organisation "…"]` | Adds any user |

## Email

Sign-in codes, invitations, reminders and submission copies are sent with the SMTP settings in
`server/.env`. While `SMTP_HOST` is empty, each email is printed in the terminal instead.

## Signing in

There are no passwords. Enter an email and the server sends a 6-digit code. A code works once, for
10 minutes; after 5 wrong tries it stops working. Asking for a new code cancels the old one, with at
most 5 codes per hour per person and 20 requests per 15 minutes per network address.
Vendors land on their form; staff on the admin pages. Sign-in lasts 8 hours from the last action.

## What the server does

| Address | Who | What |
|---|---|---|
| `GET /api/health` | anyone | Is the server up, and can it reach the database? |
| `POST /api/auth/request-code` | anyone | Send a sign-in code (same reply whether or not the email exists) |
| `POST /api/auth/register` | anyone | Register a new organisation and its first user, then send a code |
| `POST /api/auth/verify-code` | anyone | Check the code and sign in |
| `GET /api/auth/me` | signed in | Who you are, your role and organisation |
| `POST /api/auth/logout` | signed in | Sign out |
| `GET /api/my/assessment` | vendor | Your current cycle, the questionnaire, your answers and documents |
| `PUT /api/my/answers/:ref` | vendor | Save one answer |
| `POST /api/my/documents/:ref` | vendor | Upload files (PDF, DOCX, XLSX, JPG, PNG; 20 MB each) |
| `DELETE /api/my/documents/:id` | vendor | Remove your own file, until TracTrac marks it as reviewed (then it shows "Checked by TracTrac") |
| `POST /api/my/submit` | vendor | Submit (only when everything required is done) |
| `GET /api/documents/:id/file` | the document's organisation, or staff | Download a file |
| `GET /api/admin/overview` | staff | Every organisation in the current cycle, with progress and file counts |
| `POST /api/admin/organisations/:id/reminder` | staff | Email the organisation's contact a reminder |
| `GET /api/admin/organisations/:id` | staff | One organisation: its files by question |
| `GET /api/admin/organisations/:id/files.zip` | staff | All its files in one ZIP, a folder per section |
| `POST /api/admin/organisations/:id/documents/:ref` | staff | Upload a document TracTrac received (same rules as vendors) |
| `POST` / `DELETE /api/admin/organisations/:id/items/:ref/reviewed` | staff | Mark an item (all its files) as reviewed / undo |
| `GET /api/admin/staff`, `GET /api/admin/organisations` | staff | Lists for Setup |
| `POST /api/admin/staff`, `PUT /api/admin/staff/:id` | Full access | Invite staff, change a role |
| `POST /api/admin/organisations` | Full access | Add an organisation and its first user (joins the current cycle) |

Staff are the `reviewer` and `admin` ("Full access") roles. Vendors get "not allowed" on every
`/api/admin` address and only ever see their own organisation's data.

Uploaded files are saved in `UPLOAD_DIR` under random names, checked by their contents (not their
name), and only ever sent through the download addresses above.

## What's in this folder

| File | What it is |
|---|---|
| `db/schema.sql` | Every table in the database |
| `db/setup.js` | Runs `schema.sql` (`npm run db:setup`) |
| `db/fresh.js` | Empties everything and loads the questionnaire and cycle (`npm run db:fresh`) |
| `db/add-user.js` | Adds a user (`npm run create-admin`, `npm run user:add`) |
| `src/index.js` | The server: sessions, security headers, routes, and the built website in production |
| `src/auth.js` | Sign-in codes, registration, sessions, who may do what |
| `src/my.js` | The vendor's own assessment (`/api/my/...`) |
| `src/admin.js` | Staff pages (`/api/admin/...`) |
| `src/uploads.js` | Uploading and downloading files |
| `src/mail.js` | The emails |
| `src/rules.js` | What counts as "done" (the same rules as the form) |
| `src/env.js` | Reads `.env` |
| `.env.example` | Every setting; copy it to `.env` |
