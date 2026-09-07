const nodemailer = require('nodemailer');
const logger = require('./logger');

class EmailConfigError extends Error {}

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    throw new EmailConfigError(`Email is not configured: missing ${missing.join(', ')}`);
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  return cachedTransporter;
}

async function sendEmail({ to, subject, text, html }) {
  const transporter = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'MiraAdmin';
  const fromAddress = process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text,
    html,
  });

  logger.info('Email sent', { to, subject, messageId: info.messageId, accepted: info.accepted });
  return info;
}

module.exports = {
  EmailConfigError,
  getTransporter,
  sendEmail,
};
