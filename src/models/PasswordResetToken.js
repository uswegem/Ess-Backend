const mongoose = require('mongoose');
const crypto = require('crypto');
const { hashValue, compareHash } = require('../utils/tenantSecretCrypto');

// Mirrors RefreshToken.js's shape/pattern deliberately (raw token hashed via bcrypt before
// storage, never stored/logged in plaintext, single-use via usedAt, time-limited via
// expiresAt) - same threat model (a bearer token that must not be recoverable from the DB),
// so reusing the established pattern rather than inventing a new one.
const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  usedAt: Date,
  requestedIp: String
}, {
  timestamps: true
});

passwordResetTokenSchema.index({ userId: 1, usedAt: 1, createdAt: -1 });

passwordResetTokenSchema.methods.isUsable = function isUsable() {
  if (this.usedAt) return false;
  return this.expiresAt > new Date();
};

passwordResetTokenSchema.methods.markUsed = async function markUsed() {
  this.usedAt = new Date();
  return this.save();
};

passwordResetTokenSchema.statics.generateRawToken = function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
};

passwordResetTokenSchema.statics.createForUser = async function createForUser({ userId, expiresAt, requestedIp = null }) {
  const rawToken = this.generateRawToken();
  const record = await this.create({
    userId,
    tokenHash: await hashValue(rawToken),
    expiresAt,
    requestedIp
  });
  return { record, rawToken };
};

// Same linear-scan-of-recent-candidates approach as RefreshToken.findByRawToken - the raw
// token is never stored, so it can't be looked up directly by a DB query; bcrypt.compare
// against a bounded set of still-unexpired/unused candidates is the only way to find a match.
passwordResetTokenSchema.statics.findByRawToken = async function findByRawToken(rawToken) {
  const candidates = await this.find({
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 }).limit(200);

  for (const candidate of candidates) {
    const match = await compareHash(rawToken, candidate.tokenHash);
    if (match) return candidate;
  }
  return null;
};

// Counts recent (still-unexpired-window, regardless of used state) tokens for a user, used
// to throttle repeat forgot-password requests per account without needing a separate
// rate-limit store - see AuthController.forgotPassword.
passwordResetTokenSchema.statics.countRecentForUser = function countRecentForUser(userId, sinceMs) {
  return this.countDocuments({ userId, createdAt: { $gt: new Date(Date.now() - sinceMs) } });
};

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
