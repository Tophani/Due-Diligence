# Putting the Due Diligence Portal on a server

This guide takes you from an empty server to a running portal at an `https://` address.
It assumes a Linux server (Ubuntu 22.04 or 24.04). Commands to type are in grey boxes; replace
anything in CAPITALS with your own value.

The portal is one program: it runs the website and the API together, keeps its data in
PostgreSQL, and keeps uploaded files in one folder. **Back up both** (see "Backups").

---

## 1. What you need

- A Linux server you can log in to, with at least 2 GB of memory and enough disk for the uploaded files.
- A web address pointing at the server, for example `dd.tractrac.example`.
- An email account the portal can send from (SMTP details: server, port, username, password).
  Microsoft 365, Google Workspace or a sending service such as Mailgun or Brevo all work.

## 2. Install the software

```
sudo apt update
sudo apt install -y postgresql
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Check: `node -v` should show v20 or newer.

## 3. Copy the portal onto the server

Copy the `tractrac-design-handoff` folder to `/opt/due-diligence` (with `git clone`, `scp` or
an SFTP program), then install its packages:

```
cd /opt/due-diligence
npm run install:all
```

## 4. Create the database

Pick a strong password (no `@`, `:`, `/` or `#` makes life easier):

```
sudo -u postgres psql -c "CREATE USER dd WITH PASSWORD 'DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE tractrac OWNER dd;"
```

## 5. Settings (.env)

```
cp server/.env.example server/.env
nano server/.env
```

Fill it in like this:

```
NODE_ENV=production
DATABASE_URL=postgres://dd:DB_PASSWORD@localhost:5432/tractrac
PORT=4000
UPLOAD_DIR=/var/lib/due-diligence/uploads
SESSION_SECRET=PASTE_A_LONG_RANDOM_STRING
APP_URL=https://dd.tractrac.example
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=portal@tractrac.example
SMTP_PASS=EMAIL_PASSWORD
MAIL_FROM="Due Diligence Portal <portal@tractrac.example>"
CYCLE_NAME=2027 Partner Due Diligence
CYCLE_OPENS=2027-01-05
CYCLE_FIRST_SUBMISSION=2027-02-05
CYCLE_DEADLINE=2027-03-31
```

- **SESSION_SECRET**: make one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it secret.
  Changing it signs everyone out.
- **UPLOAD_DIR**: a folder outside the portal's code. Create it: `sudo mkdir -p /var/lib/due-diligence/uploads`.
- **APP_URL**: the address people type. It's used in the links inside emails.
- **SMTP**: if you leave `SMTP_HOST` empty, emails (including sign-in codes) are printed in the
  server log instead of sent. That's fine for a trial, not for real use.
- **CYCLE_…**: the due diligence round organisations will fill in. Dates are `YYYY-MM-DD`, in order:
  it opens, the first documents are due (after this, organisations with nothing uploaded show as
  "No documents yet"), and the deadline. These are only used by `npm run db:fresh` in the next step.

Keep `.env` private: `chmod 600 server/.env`.

## 6. Prepare the database and add the first user

```
npm run db:fresh -- --force
```

Type `DELETE` when asked. This creates the tables, then loads only the questionnaire and the cycle
from step 5. The database starts empty: no organisations, no users, no files. (`--force` is needed
because `NODE_ENV=production`; it's there so nobody wipes a live portal by accident.)

Then add yourself with **Full access**:

```
npm run create-admin -- --name "YOUR NAME" --email YOU@tractrac.example
```

**Never run `db:fresh` again on a portal that's in use**: it deletes every organisation, answer and
uploaded file. To bring the database up to date after an update, use `npm run db:setup` (step 12).

## 7. Build and start

```
npm run build
npm start
```

You should see `Due Diligence Portal running on http://localhost:4000`. In another window,
`curl http://localhost:4000/api/health` should answer `{"status":"ok","database":"ok"}`.
Stop it with `Ctrl+C`. The next step makes it run on its own.

## 8. Keep it running (systemd)

Create a service user and give it the upload folder:

```
sudo useradd --system --home /opt/due-diligence dd
sudo chown -R dd:dd /opt/due-diligence /var/lib/due-diligence
```

Create `/etc/systemd/system/due-diligence.service`:

```
[Unit]
Description=Due Diligence Portal
After=network.target postgresql.service

[Service]
User=dd
WorkingDirectory=/opt/due-diligence
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:

```
sudo systemctl daemon-reload
sudo systemctl enable --now due-diligence
sudo systemctl status due-diligence
```

Its log (including any email errors): `sudo journalctl -u due-diligence -f`.

## 9. Turn on https (Caddy)

The portal must be reached over `https://`, or sign-in won't work (the sign-in cookie is only sent
over https). Caddy gets and renews the certificate for you.

```
sudo apt install -y caddy
```

Replace everything in `/etc/caddy/Caddyfile` with:

```
dd.tractrac.example {
    reverse_proxy localhost:4000
}
```

```
sudo systemctl restart caddy
```

Open `https://dd.tractrac.example` and sign in with the email from step 6.
Make sure the firewall allows ports 80 and 443 only (not 4000 or 5432).

## 10. Adding people

- **TracTrac staff**: sign in with Full access → **Setup** → **+ Invite staff** (Reviewer or Full access).
  They get an invitation email.
- **Vendor organisations**: **Setup** → **+ Add organisation** with the contact's name and email.
  The contact gets an invitation email. Organisations can also register themselves on the sign-in page.
- **From the server** (for example if nobody with Full access can sign in):

  ```
  npm run create-admin -- --name "Full Name" --email someone@tractrac.example
  npm run user:add -- --name "Full Name" --email someone@tractrac.example --role reviewer
  npm run user:add -- --name "Full Name" --email contact@vendor.example --role vendor --organisation "Organisation name"
  ```

  `create-admin` adds Full access. With `user:add` the roles are `admin` (Full access), `reviewer` and
  `vendor` (a new organisation joins the open cycle). No email is sent; tell the person to sign in with their email.

## 11. Backups

You need **two things**, from the same time: the database and the uploads folder. One without the
other is incomplete.

Make a backup folder: `sudo mkdir -p /var/backups/due-diligence && sudo chown postgres /var/backups/due-diligence`

**Every night** (as root: `sudo crontab -e`, then add these lines):

```
30 1 * * * sudo -u postgres pg_dump -Fc tractrac > /var/backups/due-diligence/db-$(date +\%F).dump
45 1 * * * tar -czf /var/backups/due-diligence/uploads-$(date +\%F).tar.gz -C /var/lib/due-diligence uploads
0 3 * * * find /var/backups/due-diligence -mtime +30 -delete
```

That keeps 30 days. **Copy the backup folder off the server** as well (another server, cloud
storage, or your backup system). A backup on the same disk doesn't survive the disk.

**To restore** (stop the portal first: `sudo systemctl stop due-diligence`):

```
sudo -u postgres dropdb tractrac
sudo -u postgres createdb -O dd tractrac
sudo -u postgres pg_restore -d tractrac /var/backups/due-diligence/db-2026-11-11.dump
sudo tar -xzf /var/backups/due-diligence/uploads-2026-11-11.tar.gz -C /var/lib/due-diligence
sudo chown -R dd:dd /var/lib/due-diligence
sudo systemctl start due-diligence
```

Try a restore on a spare machine once, so you know it works before you need it.

## 12. Updating the portal

```
cd /opt/due-diligence
# copy in the new version (git pull, or replace the files but keep server/.env)
npm run install:all
npm run db:setup
npm run build
sudo systemctl restart due-diligence
```

`db:setup` is safe to run every time: it keeps your data and only adds what's missing (some updates
also remove old columns, so back up first). Don't use `db:fresh` here.

## If something goes wrong

- **Sign-in codes don't arrive**: look at the log (`journalctl -u due-diligence`). "SMTP isn't set up"
  means `SMTP_HOST` is empty; other errors come from the email provider (wrong password, sender not allowed).
- **Signing in goes back to the sign-in page**: the site isn't on `https://`, or there's a second
  proxy in front of Caddy. Check `APP_URL` and step 9.
- **Too many attempts**: the portal limits sign-in codes per person and per network address. Wait 15 minutes.
- **The portal won't start**: the log says why (missing setting, database unreachable, app not built).
