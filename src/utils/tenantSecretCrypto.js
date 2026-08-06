const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const BCRYPT_ROUNDS = 10;

function getEncryptionKey() {
  const raw = process.env.TENANT_SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('TENANT_SECRET_ENCRYPTION_KEY is required for secret encryption');
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('TENANT_SECRET_ENCRYPTION_KEY must be 32 bytes (64-char hex or base64)');
  }
  return buf;
}

function encryptSecret(plaintext) {
  if (!plaintext) return plaintext;
  if (typeof plaintext === 'string' && plaintext.includes(':')) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(ciphertext) {
  if (!ciphertext) return null;
  if (!ciphertext.includes(':')) return ciphertext;

  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Invalid encrypted secret format');
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

async function hashValue(value) {
  return bcrypt.hash(value, BCRYPT_ROUNDS);
}

async function compareHash(value, hash) {
  return bcrypt.compare(value, hash);
}

function generateApiKey(prefix = 'mk_live') {
  const token = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${token}`;
}

function generateApiSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function maskSecret(value, visible = 4) {
  if (!value) return '';
  if (value.length <= visible * 2) return '*'.repeat(value.length);
  return `${value.slice(0, visible)}${'*'.repeat(Math.max(4, value.length - visible * 2))}${value.slice(-visible)}`;
}

function validateApiKeyFormat(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return false;
  return /^(mk_live|mk_test)_[A-Za-z0-9_-]{20,}$/.test(rawKey);
}

module.exports = {
  encryptSecret,
  decryptSecret,
  hashValue,
  compareHash,
  generateApiKey,
  generateApiSecret,
  maskSecret,
  validateApiKeyFormat
};
