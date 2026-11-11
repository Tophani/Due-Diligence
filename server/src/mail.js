// Emails: sign-in codes, invitations, reminders and the submission copy.
// Sent with nodemailer through the SMTP server in .env. If SMTP_HOST isn't set (e.g. on a
// developer's machine), each email is printed in the terminal instead, so sign-in still works.
import nodemailer from 'nodemailer';
import { APP_URL, SMTP } from './env.js';

const NAME = 'Due Diligence Portal';
const COMPANY = 'TracTrac Mechanization Services Limited';
const SIGN_OFF = `\n\n${NAME}\n${COMPANY}`;
const SIGN_IN = `${APP_URL}/signin`;

export const mailConfigured = !!SMTP.host;

const transport = mailConfigured
  ? nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.port === 465, // 465 = TLS from the start; 587/25 upgrade with STARTTLS
      auth: SMTP.user ? { user: SMTP.user, pass: SMTP.pass } : undefined,
    })
  : null;

/** "smtp.gmail.com:587 as someone@gmail.com" — for logs. Never includes the password. */
export const smtpSummary = () => (mailConfigured ? `${SMTP.host}:${SMTP.port} as ${SMTP.user || '(no username)'}, from ${SMTP.from}` : 'not set up');

/** Log in to the SMTP server without sending anything. Resolves to null, or the error. */
export async function verifySmtp() {
  if (!transport) return null;
  try {
    await transport.verify();
    return null;
  } catch (err) {
    return err;
  }
}

/** The SMTP server's full reason, e.g. "EAUTH 535-5.7.8 Username and Password not accepted…". */
export const describeMailError = (err) => [err.code, err.responseCode, err.response || err.message].filter(Boolean).join(' ');

/**
 * Send one plain-text email (or print it when SMTP isn't set). Throws if the SMTP server refuses it.
 * Returns the SMTP server's reply on success.
 */
export async function sendMail({ to, subject, text }) {
  if (!transport) {
    const body = text.replace(/\n/g, '\n    ');
    console.log(`\n  [${NAME}] Email (printed because SMTP isn't set up)\n    To: ${to}\n    Subject: ${subject}\n\n    ${body}\n`);
    return 'printed';
  }
  const info = await transport.sendMail({ from: SMTP.from, to, subject, text });
  return info.response;
}

// ---- The emails ----------------------------------------------------------------------------

export const codeEmail = (to, code, minutes) =>
  sendMail({
    to,
    subject: `Your ${NAME} sign-in code: ${code}`,
    text: `Your sign-in code is ${code}\n\nIt works for ${minutes} minutes. If you didn't ask for it, you can ignore this email.${SIGN_OFF}`,
  });

export const organisationInvite = ({ to, name, organisation }) =>
  sendMail({
    to,
    subject: `You're invited to the ${NAME}`,
    text:
      `Hello ${name},\n\nTracTrac has invited ${organisation} to complete its due diligence form.\n\n` +
      `Sign in at ${SIGN_IN} with this email address. We'll email you a code each time, so there's no password to remember.${SIGN_OFF}`,
  });

export const staffInvite = ({ to, name, role }) =>
  sendMail({
    to,
    subject: `You've been added to the ${NAME}`,
    text:
      `Hello ${name},\n\nYou've been added to the ${NAME} with ${role === 'admin' ? 'Full access' : 'Reviewer access'}.\n\n` +
      `Sign in at ${SIGN_IN} with this email address. We'll email you a code each time.${SIGN_OFF}`,
  });

export const reminderEmail = ({ to, name, organisation, deadline }) =>
  sendMail({
    to,
    subject: `Reminder: your ${NAME} form`,
    text:
      `Hello ${name || 'there'},\n\nThis is a reminder that TracTrac is waiting for ${organisation}'s due diligence form and documents` +
      `${deadline ? `. Please complete it by ${deadline}` : ''}.\n\nSign in at ${SIGN_IN} to continue where you left off.${SIGN_OFF}`,
  });

export const submittedEmail = ({ to, name, organisation, reference }) =>
  sendMail({
    to,
    subject: `${NAME}: form received (${reference})`,
    text:
      `Hello ${name},\n\nThank you. We've received ${organisation}'s due diligence form. Your reference is ${reference}.\n\n` +
      `Your answers are now locked while TracTrac checks your documents. Submitting doesn't mean your organisation has been approved; TracTrac will let you know the outcome.${SIGN_OFF}`,
  });
