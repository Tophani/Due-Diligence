// npm run test-email -- someone@example.com
//
// Sends one test email with the SMTP settings in server/.env and prints "Sent" or the full error.
// Shows which SMTP server and username are used, never the password.
import { ENV_FILE, SMTP } from '../src/env.js';
import { describeMailError, mailConfigured, sendMail, smtpSummary } from '../src/mail.js';

const to = (process.argv[2] || '').trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Usage: npm run test-email -- someone@example.com');
  process.exit(1);
}

console.log(`Settings file: ${ENV_FILE}`);
if (!mailConfigured) {
  console.error('SMTP isn’t set up: SMTP_HOST is empty in that file, so emails are only printed in the server log. Nothing was sent.');
  process.exit(1);
}
console.log(`SMTP: ${smtpSummary()}`);
console.log(`Sending a test email to ${to}…`);

try {
  const reply = await sendMail({
    to,
    subject: 'Due Diligence Portal: test email',
    text: `This is a test email from the Due Diligence Portal, sent through ${SMTP.host}.\n\nIf you can read this, email is working.\n\nDue Diligence Portal\nTracTrac Mechanization Services Limited`,
  });
  console.log(`Sent (the mail server said: ${reply})`);
  console.log('If it doesn’t arrive within a few minutes, check the spam folder.');
} catch (err) {
  console.error(`Not sent. The full error:\n${describeMailError(err)}`);
  if (err.responseCode === 535 && /gmail/i.test(SMTP.host)) {
    console.error(
      '\nGmail refused the username or password. Gmail needs an App Password (16 letters), not your normal password:\n' +
        '  1. Turn on 2-Step Verification for the account (myaccount.google.com → Security).\n' +
        '  2. Create an App Password at myaccount.google.com/apppasswords.\n' +
        '  3. Put it in SMTP_PASS in server/.env (spaces can be left out), and SMTP_USER must be the full Gmail address.',
    );
  }
  if (err.stack && !err.responseCode) console.error(`\n${err.stack}`);
  process.exit(1);
}
