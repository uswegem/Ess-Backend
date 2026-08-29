const nodemailer = require('nodemailer');
const logger = require('./logger');

// Lazily built - env vars are read at call time (not module load time) so tests/tools
// that stub process.env before requiring this module still work.
let cachedTransporter = null;
let cachedTransportKey = null;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransporter() {
  const key = `${process.env.SMTP_HOST}:${process.env.SMTP_PORT}:${process.env.SMTP_USER}`;
  if (cachedTransporter && cachedTransportKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // false for STARTTLS on 587, true for implicit TLS on 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
  cachedTransportKey = key;
  return cachedTransporter;
}

/**
 * Send an email via the configured SMTP transport.
 *
 * If SMTP isn't configured (no SMTP_HOST/SMTP_USER/SMTP_PASSWORD), this logs the email
 * content instead of throwing - callers (e.g. password reset) that must not reveal
 * whether sending succeeded to the end user can safely call this without special-casing
 * the "not configured yet" case; it degrades to a log-only mode rather than breaking the
 * flow, matching how this codebase already treats other optional integrations.
 */
async function sendMail({ to, subject, text, html }) {
  if (!isConfigured()) {
    logger.warn('SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD) - logging email instead of sending', {
      to, subject, text
    });
    return { sent: false, reason: 'not_configured' };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'MiraAdmin';
  const fromAddress = process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER;

  try {
    await getTransporter().sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (error) {
    // Never let a mail-sending failure leak to the caller as a thrown exception when the
    // caller's contract is "always return the same generic response regardless of outcome"
    // (see forgot-password) - log it server-side for operator visibility instead.
    logger.error('Failed to send email:', { to, subject, error: error.message });
    return { sent: false, reason: 'send_error', error: error.message };
  }
}

module.exports = { sendMail, isConfigured };
